import "server-only"

import { and, count, eq, gte, lte, sql } from "drizzle-orm"
import type { z } from "zod"

import { db } from "@/db"
import { bankAccounts, cars, customers, dealerships, finalInvoices, proformaInvoices } from "@/db/schema"
import { HttpError } from "@/server/http"
import { allWordsMatch, dateParam, dealershipScope, enumListParam, numberParam, parseListParams } from "@/server/list-params"

import type { InvoiceKind, invoiceSchema } from "./schema"

type Input = z.output<typeof invoiceSchema>

const tables = { proforma: proformaInvoices, final: finalInvoices } as const

function amounts(input: Input) {
  const agreedPrice = Number(input.agreedPrice)
  const deposit = input.deposit === "" ? 0 : Number(input.deposit)
  return { agreedPrice, deposit, balance: Math.max(0, agreedPrice - deposit) }
}

/** `scope`: the staff user's dealership, or `null` for the super admin. */
export async function listInvoices(kind: InvoiceKind, scope: string | null, url: string) {
  const table = tables[kind]
  const { perPage, offset, q, orderBy } = parseListParams(
    url,
    { number: table.number, createdAt: table.createdAt, agreedPrice: table.agreedPrice },
    "number.desc",
  )
  const [status] = enumListParam(url, "status", ["draft", "live"] as const)
  const from = dateParam(url, "from")
  const to = dateParam(url, "to")
  const minPrice = numberParam(url, "minPrice")
  const maxPrice = numberParam(url, "maxPrice")
  const where = and(
    dealershipScope(table.dealershipId, scope, url),
    kind === "proforma" && status ? eq(proformaInvoices.status, status) : undefined,
    from ? gte(sql`(${table.createdAt} at time zone 'Africa/Nairobi')::date`, from) : undefined,
    to ? lte(sql`(${table.createdAt} at time zone 'Africa/Nairobi')::date`, to) : undefined,
    minPrice !== undefined ? gte(table.agreedPrice, minPrice) : undefined,
    maxPrice !== undefined ? lte(table.agreedPrice, maxPrice) : undefined,
    q
      ? allWordsMatch(q.replace(/^(pro|inv)-?0*/i, ""), [
          sql`${table.number}::text`,
          customers.name,
          sql`(${cars.brand} || ' ' || ${cars.name})`,
          cars.regNo,
        ])
      : undefined,
  )

  const base = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(table)
      .innerJoin(dealerships, eq(dealerships.id, table.dealershipId))
      .innerJoin(customers, eq(customers.id, table.customerId))
      .innerJoin(cars, eq(cars.id, table.carId))
      .leftJoin(bankAccounts, eq(bankAccounts.id, table.bankAccountId))
      .where(where)

  const linked =
    kind === "proforma"
      ? sql<number | null>`(select f.number from ${finalInvoices} f where f.proforma_invoice_id = ${proformaInvoices.id})`
      : sql<number | null>`(select p.number from ${proformaInvoices} p where p.id = ${finalInvoices.proformaInvoiceId})`

  const [rows, [total]] = await Promise.all([
    base({
      id: table.id,
      number: table.number,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      status: kind === "proforma" ? proformaInvoices.status : sql<string>`'live'`,
      agreedPrice: table.agreedPrice,
      deposit: table.deposit,
      balance: table.balance,
      createdAt: table.createdAt,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.telephone,
      carId: cars.id,
      carTitle: sql<string>`${cars.year} || ' ' || ${cars.brand} || ' ' || ${cars.name}`,
      carRegNo: cars.regNo,
      bankAccountId: table.bankAccountId,
      bankAccountLabel: sql<string | null>`${bankAccounts.bankName} || ' · ' || ${bankAccounts.accountNumber}`,
      linkedNumber: linked,
    })
      .orderBy(orderBy, table.id)
      .limit(perPage)
      .offset(offset) as Promise<InvoiceListRow[]>,
    base({ value: count() }) as Promise<{ value: number }[]>,
  ])
  return { rows, rowCount: total?.value ?? 0 }
}

export type InvoiceListRow = {
  id: string
  number: number
  dealershipCode: string
  dealershipName: string
  status: "draft" | "live"
  agreedPrice: number
  deposit: number
  balance: number
  createdAt: Date
  customerId: string
  customerName: string
  customerPhone: string
  carId: string
  carTitle: string
  carRegNo: string | null
  bankAccountId: string | null
  bankAccountLabel: string | null
  linkedNumber: number | null
}

export async function createInvoice(kind: InvoiceKind, dealershipId: string, input: Input) {
  const values = {
    dealershipId,
    customerId: input.customerId,
    carId: input.carId,
    bankAccountId: input.bankAccountId,
    ...amounts(input),
  }
  if (kind === "final") {
    const [row] = await db.insert(finalInvoices).values(values).returning()
    return row!
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(proformaInvoices).values({ ...values, status: input.status }).returning()
    if (input.status === "live") await tx.insert(finalInvoices).values({ ...values, proformaInvoiceId: row!.id })
    return row!
  })
}

export async function updateInvoice(kind: InvoiceKind, dealershipId: string, id: string, input: Input) {
  const values = { customerId: input.customerId, carId: input.carId, bankAccountId: input.bankAccountId, ...amounts(input) }
  if (kind === "final") {
    const [row] = await db
      .update(finalInvoices)
      .set(values)
      .where(and(eq(finalInvoices.id, id), eq(finalInvoices.dealershipId, dealershipId)))
      .returning()
    return row
  }
  const [existing] = await db
    .select({ status: proformaInvoices.status })
    .from(proformaInvoices)
    .where(and(eq(proformaInvoices.id, id), eq(proformaInvoices.dealershipId, dealershipId)))
  if (!existing) return undefined
  if (existing.status === "live") {
    throw new HttpError(409, "This proforma is live and already has a final invoice. Edit the final invoice instead.")
  }
  const [row] = await db.update(proformaInvoices).set(values).where(eq(proformaInvoices.id, id)).returning()
  return row
}

/** Draft → live: freezes the proforma and issues its final invoice, atomically. */
export async function publishProforma(dealershipId: string, id: string) {
  return db.transaction(async (tx) => {
    const [proforma] = await tx
      .select()
      .from(proformaInvoices)
      .where(and(eq(proformaInvoices.id, id), eq(proformaInvoices.dealershipId, dealershipId)))
      .for("update")
    if (!proforma) throw new HttpError(404, "Proforma invoice not found")
    if (proforma.status === "live") throw new HttpError(409, "This proforma is already live")
    await tx.update(proformaInvoices).set({ status: "live" }).where(eq(proformaInvoices.id, id))
    const [finalInvoice] = await tx
      .insert(finalInvoices)
      .values({
        proformaInvoiceId: proforma.id,
        dealershipId: proforma.dealershipId,
        customerId: proforma.customerId,
        carId: proforma.carId,
        bankAccountId: proforma.bankAccountId,
        agreedPrice: proforma.agreedPrice,
        deposit: proforma.deposit,
        balance: proforma.balance,
      })
      .returning({ id: finalInvoices.id, number: finalInvoices.number })
    return finalInvoice!
  })
}

export async function deleteInvoice(kind: InvoiceKind, dealershipId: string, id: string) {
  const table = tables[kind]
  const [row] = await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.dealershipId, dealershipId)))
    .returning({ id: table.id })
  return row
}

/** Everything the PDF generator needs, in one round trip. */
export async function getInvoiceForDocument(kind: InvoiceKind, scope: string | null, id: string) {
  const table = tables[kind]
  const [row] = await db
    .select({ invoice: table, customer: customers, car: cars, bankAccount: bankAccounts })
    .from(table)
    .innerJoin(customers, eq(customers.id, table.customerId))
    .innerJoin(cars, eq(cars.id, table.carId))
    .leftJoin(bankAccounts, eq(bankAccounts.id, table.bankAccountId))
    .where(and(eq(table.id, id), scope ? eq(table.dealershipId, scope) : undefined))
  return row ?? null
}

export type InvoiceDocumentData = NonNullable<Awaited<ReturnType<typeof getInvoiceForDocument>>>
