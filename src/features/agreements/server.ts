import "server-only"

import { and, asc, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/db"
import {
  agreementDocuments,
  agreements,
  agreementTradeIns,
  bankAccounts,
  cars,
  customers,
  dealerships,
  installments,
  paymentAllocations,
  payments,
} from "@/db/schema"
import { buildSchedule, installmentStatus } from "@/features/installments/ledger"
import { isOpenSql, isOverdueSql, remainingSql } from "@/features/installments/sql"
import { HttpError } from "@/server/http"
import { allWordsMatch, dateParam, dealershipScope, enumListParam, numberParam, parseListParams } from "@/server/list-params"
import { deleteStoredFile } from "@/server/storage"

import { AGREEMENT_TYPES, type AgreementInput, type AgreementType } from "./schema"

const buyer = alias(customers, "buyer")
const seller = alias(customers, "seller")

const hpSummary = db
  .select({
    agreementId: installments.agreementId,
    outstanding: sql<number>`sum(${remainingSql})`.mapWith(Number).as("outstanding"),
    overdueCount: sql<number>`count(*) filter (where ${isOverdueSql})`.mapWith(Number).as("overdue_count"),
    installmentCount: sql<number>`count(*)`.mapWith(Number).as("installment_count"),
    settledCount: sql<number>`count(*) filter (where not ${isOpenSql})`.mapWith(Number).as("settled_count"),
    nextDueDate: sql<string | null>`min(${installments.dueDate}) filter (where ${isOpenSql})`.as("next_due_date"),
  })
  .from(installments)
  .groupBy(installments.agreementId)
  .as("hp")

const sortable = {
  number: agreements.number,
  createdAt: agreements.createdAt,
  agreedPrice: agreements.agreedPrice,
  balance: agreements.balance,
}

export const AGREEMENT_STATUSES = ["overdue", "on_track", "completed"] as const

/** `scope`: the staff user's dealership, or `null` for the super admin (all dealerships, optional ?dealership filter). */
export async function listAgreements(scope: string | null, url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(url, sortable, "number.desc")
  const types = enumListParam(url, "type", AGREEMENT_TYPES)
  const statuses = enumListParam(url, "status", AGREEMENT_STATUSES)
  const from = dateParam(url, "from")
  const to = dateParam(url, "to")
  const minPrice = numberParam(url, "minPrice")
  const maxPrice = numberParam(url, "maxPrice")
  const statusSql = {
    overdue: sql`coalesce(${hpSummary.overdueCount}, 0) > 0`,
    on_track: sql`coalesce(${hpSummary.outstanding}, 0) > 0 and coalesce(${hpSummary.overdueCount}, 0) = 0`,
    completed: sql`${hpSummary.installmentCount} > 0 and ${hpSummary.outstanding} = 0`,
  }

  const where = and(
    dealershipScope(agreements.dealershipId, scope, url),
    types.length ? inArray(agreements.type, types) : undefined,
    statuses.length ? or(...statuses.map((status) => statusSql[status])) : undefined,
    from ? gte(sql`(${agreements.createdAt} at time zone 'Africa/Nairobi')::date`, from) : undefined,
    to ? lte(sql`(${agreements.createdAt} at time zone 'Africa/Nairobi')::date`, to) : undefined,
    minPrice !== undefined ? gte(agreements.agreedPrice, minPrice) : undefined,
    maxPrice !== undefined ? lte(agreements.agreedPrice, maxPrice) : undefined,
    q
      ? allWordsMatch(q.replace(/^[a-z]{2,5}-(?=\d)/i, ""), [
          sql`${agreements.number}::text`,
          buyer.name,
          seller.name,
          sql`(${cars.brand} || ' ' || ${cars.name})`,
          cars.regNo,
        ])
      : undefined,
  )

  const joined = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(agreements)
      .innerJoin(dealerships, eq(dealerships.id, agreements.dealershipId))
      .innerJoin(cars, eq(cars.id, agreements.carId))
      .leftJoin(buyer, eq(buyer.id, agreements.customerId))
      .leftJoin(seller, eq(seller.id, agreements.sellerId))
      .leftJoin(hpSummary, eq(hpSummary.agreementId, agreements.id))
      .where(where)

  const [rows, [total]] = await Promise.all([
    joined({
      id: agreements.id,
      number: agreements.number,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      type: agreements.type,
      agreedPrice: agreements.agreedPrice,
      deposit: agreements.deposit,
      balance: agreements.balance,
      createdAt: agreements.createdAt,
      buyerName: buyer.name,
      sellerName: seller.name,
      carBrand: cars.brand,
      carName: cars.name,
      carYear: cars.year,
      carRegNo: cars.regNo,
      outstanding: hpSummary.outstanding,
      overdueCount: hpSummary.overdueCount,
      installmentCount: hpSummary.installmentCount,
      settledCount: hpSummary.settledCount,
      nextDueDate: hpSummary.nextDueDate,
    })
      .orderBy(orderBy, agreements.id)
      .limit(perPage)
      .offset(offset) as Promise<AgreementListRow[]>,
    joined({ value: count() }) as Promise<{ value: number }[]>,
  ])
  return { rows, rowCount: total?.value ?? 0 }
}

export type AgreementListRow = {
  id: string
  number: number
  dealershipCode: string
  dealershipName: string
  type: AgreementType
  agreedPrice: number
  deposit: number
  balance: number
  createdAt: Date
  buyerName: string | null
  sellerName: string | null
  carBrand: string
  carName: string
  carYear: number
  carRegNo: string | null
  outstanding: number | null
  overdueCount: number | null
  installmentCount: number | null
  settledCount: number | null
  nextDueDate: string | null
}

/** `scope` null = super admin (any dealership). */
export async function getAgreement(scope: string | null, id: string) {
  const agreement = await db.query.agreements.findFirst({
    where: and(eq(agreements.id, id), scope ? eq(agreements.dealershipId, scope) : undefined),
  })
  if (!agreement) return null
  const [dealership] = await db.select().from(dealerships).where(eq(dealerships.id, agreement.dealershipId))

  const partyIds = [agreement.customerId, agreement.sellerId, agreement.witnessId, agreement.nextOfKinId].filter(
    (value): value is string => Boolean(value),
  )

  const [parties, [car], [bankAccount], tradeIns, schedule, paymentRows, documents] = await Promise.all([
    partyIds.length ? db.select().from(customers).where(inArray(customers.id, partyIds)) : [],
    db.select().from(cars).where(eq(cars.id, agreement.carId)),
    agreement.bankAccountId
      ? db.select().from(bankAccounts).where(eq(bankAccounts.id, agreement.bankAccountId))
      : Promise.resolve([]),
    db
      .select({ id: agreementTradeIns.id, kind: agreementTradeIns.kind, amount: agreementTradeIns.amount, car: cars })
      .from(agreementTradeIns)
      .innerJoin(cars, eq(cars.id, agreementTradeIns.carId))
      .where(eq(agreementTradeIns.agreementId, id)),
    db.select().from(installments).where(eq(installments.agreementId, id)).orderBy(asc(installments.sequence)),
    db
      .select({
        id: payments.id,
        installmentId: payments.installmentId,
        amount: payments.amount,
        paidOn: payments.paidOn,
        notes: payments.notes,
        receiptName: payments.receiptName,
        createdAt: payments.createdAt,
        carried: sql<number>`coalesce((select sum(${paymentAllocations.amount}) from ${paymentAllocations} where ${paymentAllocations.paymentId} = ${payments.id} and ${paymentAllocations.kind} = 'carry_out'), 0)`.mapWith(Number),
      })
      .from(payments)
      .where(eq(payments.agreementId, id))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        id: agreementDocuments.id,
        fileName: agreementDocuments.fileName,
        mimeType: agreementDocuments.mimeType,
        sizeBytes: agreementDocuments.sizeBytes,
        uploadedAt: agreementDocuments.uploadedAt,
      })
      .from(agreementDocuments)
      .where(eq(agreementDocuments.agreementId, id))
      .orderBy(desc(agreementDocuments.uploadedAt)),
  ])

  const byId = (partyId: string | null) => parties.find((party) => party.id === partyId) ?? null
  const sequenceOf = new Map(schedule.map((i) => [i.id, i.sequence]))

  return {
    ...agreement,
    dealership: dealership!,
    buyer: byId(agreement.customerId),
    seller: byId(agreement.sellerId),
    witness: byId(agreement.witnessId),
    nextOfKin: byId(agreement.nextOfKinId),
    car: car!,
    bankAccount: bankAccount ?? null,
    tradeIns,
    installments: schedule.map((i) => ({ ...i, status: installmentStatus(i) })),
    payments: paymentRows.map((payment, index) => ({
      ...payment,
      installmentSequence: sequenceOf.get(payment.installmentId) ?? null,
      // Only the most recent payment can be reversed; later payments were planned against its effects.
      canReverse: index === 0,
    })),
    documents,
  }
}

export type AgreementDetail = NonNullable<Awaited<ReturnType<typeof getAgreement>>>

function toRecord(input: AgreementInput) {
  const agreedPrice = Number(input.agreedPrice)
  const deposit = input.deposit === "" ? 0 : Number(input.deposit)
  const isHp = input.type === "hire_purchase"
  return {
    type: input.type,
    customerId: input.customerId || null,
    sellerId: input.sellerId || null,
    witnessId: input.witnessId || null,
    nextOfKinId: input.nextOfKinId || null,
    carId: input.carId,
    bankAccountId: input.bankAccountId || null,
    agreedPrice,
    deposit,
    balance: Math.max(0, agreedPrice - deposit),
    remainingDepositPaymentMethod: input.remainingDepositPaymentMethod || null,
    paybill: input.paybill || null,
    physicalLogbook: input.physicalLogbook,
    transferLogbook: input.transferLogbook,
    uponPayment: input.uponPayment,
    installmentFrequency: isHp ? input.installmentFrequency || null : null,
    installmentDuration: isHp ? Number(input.installmentDuration) : null,
    startingDate: isHp ? input.startingDate || null : null,
    hasTracker: isHp && input.hasTracker,
    trackerFee: isHp && input.hasTracker ? Number(input.trackerFee) : null,
    trackerDuration: isHp && input.hasTracker ? input.trackerDuration : null,
    includeAdditionalNotes: isHp && input.includeAdditionalNotes,
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const tradeInKindFor = (type: AgreementType): "cash" | "buying" | "hire_purchase" => (type === "cash_sale" ? "cash" : type)

async function writeTradeIns(tx: Tx, dealershipId: string, agreementId: string, input: AgreementInput) {
  await tx.delete(agreementTradeIns).where(eq(agreementTradeIns.agreementId, agreementId))
  if (input.tradeIns.length === 0) return
  await tx.insert(agreementTradeIns).values(
    input.tradeIns.map((tradeIn) => ({
      dealershipId,
      agreementId,
      carId: tradeIn.carId,
      kind: tradeInKindFor(input.type),
      amount: Number(tradeIn.amount),
    })),
  )
}

async function writeSchedule(tx: Tx, agreementId: string, record: ReturnType<typeof toRecord>) {
  await tx.delete(installments).where(eq(installments.agreementId, agreementId))
  if (record.type !== "hire_purchase") return
  const schedule = buildSchedule({
    balance: record.balance,
    frequency: record.installmentFrequency!,
    duration: record.installmentDuration!,
    startingDate: record.startingDate!,
  })
  await tx.insert(installments).values(schedule.map((row) => ({ ...row, agreementId })))
}

export async function createAgreement(dealershipId: string, input: AgreementInput) {
  const record = toRecord(input)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(agreements)
      .values({ ...record, dealershipId })
      .returning({ id: agreements.id, number: agreements.number })
    await writeTradeIns(tx, dealershipId, row!.id, input)
    await writeSchedule(tx, row!.id, record)
    return row!
  })
}

const scheduleFields = ["type", "agreedPrice", "deposit", "installmentFrequency", "installmentDuration", "startingDate"] as const

export async function updateAgreement(dealershipId: string, id: string, input: AgreementInput) {
  const record = toRecord(input)
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, id), eq(agreements.dealershipId, dealershipId)))
      .for("update")
    if (!existing) return null

    const scheduleChanged = scheduleFields.some((field) => String(existing[field] ?? "") !== String(record[field] ?? ""))
    if (scheduleChanged) {
      const paymentCount = await tx.$count(payments, eq(payments.agreementId, id))
      if (paymentCount > 0) {
        throw new HttpError(
          409,
          "Payments have been recorded, so the type, price, deposit and installment terms are locked. Reverse the payments first to change them.",
        )
      }
    }

    const [row] = await tx
      .update(agreements)
      .set(record)
      .where(eq(agreements.id, id))
      .returning({ id: agreements.id, number: agreements.number })
    await writeTradeIns(tx, dealershipId, id, input)
    if (scheduleChanged) await writeSchedule(tx, id, record)
    return row!
  })
}

export async function deleteAgreement(dealershipId: string, id: string) {
  const documentKeys = await db
    .select({ key: agreementDocuments.storageKey })
    .from(agreementDocuments)
    .where(eq(agreementDocuments.agreementId, id))
  // Payments reference the agreement with ON DELETE RESTRICT, so an agreement with a payment history can't vanish.
  const [row] = await db
    .delete(agreements)
    .where(and(eq(agreements.id, id), eq(agreements.dealershipId, dealershipId)))
    .returning({ id: agreements.id })
  if (row) await Promise.all(documentKeys.map(({ key }) => deleteStoredFile(key)))
  return row
}
