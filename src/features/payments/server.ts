import "server-only"

import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { db } from "@/db"
import { agreements, cars, customers, dealerships, installments, paymentAllocations, payments } from "@/db/schema"
import { assertAgreementInScope } from "@/features/agreements/guard"
import { PaymentPlanError, planPayment, round2 } from "@/features/installments/ledger"
import { HttpError } from "@/server/http"
import { allWordsMatch, dateParam, dealershipScope, numberParam, parseListParams } from "@/server/list-params"
import { deleteStoredFile, readStoredFile, RECEIPT_TYPES, saveFile, validateUpload } from "@/server/storage"

export const recordPaymentSchema = z.object({
  installmentId: z.uuid("Choose the installment being paid"),
  amount: z.coerce.number<string>().positive("Enter the amount received").max(1_000_000_000),
  paidOn: z.iso.date("Pick the payment date"),
  notes: z.string().trim().max(500).default(""),
  carryShortfall: z.enum(["true", "false"]).transform((value) => value === "true"),
})

export async function recordPayment(scope: string, agreementId: string, form: FormData) {
  await assertAgreementInScope(scope, agreementId)
  const parsed = recordPaymentSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")))
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]))
    throw new HttpError(422, "Please fix the highlighted fields", fieldErrors)
  }
  const input = parsed.data
  const receipt = validateUpload(form.get("receipt"), RECEIPT_TYPES, 5)
  const receiptKey = await saveFile(`receipts/${agreementId}`, receipt, RECEIPT_TYPES)

  try {
    return await db.transaction(async (tx) => {
      // Lock the whole schedule so concurrent payments on the same agreement are applied one after another.
      const schedule = await tx
        .select()
        .from(installments)
        .where(eq(installments.agreementId, agreementId))
        .orderBy(installments.sequence)
        .for("update")
      if (schedule.length === 0) throw new HttpError(404, "This agreement has no installment schedule")

      let plan
      try {
        plan = planPayment(schedule, input.installmentId, input.amount, input.carryShortfall)
      } catch (error) {
        if (error instanceof PaymentPlanError) throw new HttpError(422, error.message, { amount: error.message })
        throw error
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          agreementId,
          installmentId: input.installmentId,
          amount: round2(input.amount),
          paidOn: input.paidOn,
          notes: input.notes || null,
          receiptKey,
          receiptName: receipt.name,
          receiptMimeType: receipt.type,
        })
        .returning()

      await tx.insert(paymentAllocations).values(plan.allocations.map((a) => ({ ...a, paymentId: payment!.id })))
      for (const allocation of plan.allocations) await applyAllocation(tx, allocation, 1)

      return { payment: payment!, plan }
    })
  } catch (error) {
    await deleteStoredFile(receiptKey)
    throw error
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const allocationColumn = { paid: "paid", carry_out: "carriedForward", carry_in: "carriedOver" } as const

async function applyAllocation(
  tx: Tx,
  allocation: { installmentId: string; kind: keyof typeof allocationColumn; amount: number },
  direction: 1 | -1,
) {
  const key = allocationColumn[allocation.kind]
  await tx
    .update(installments)
    .set({
      [key]: sql`${installments[key]} + ${allocation.amount * direction}`,
      ...(allocation.kind === "paid" && direction === 1 ? { lastPaidAt: new Date() } : {}),
    })
    .where(eq(installments.id, allocation.installmentId))
}

export async function reversePayment(scope: string, agreementId: string, paymentId: string) {
  await assertAgreementInScope(scope, agreementId)
  const receiptKey = await db.transaction(async (tx) => {
    await tx.select({ id: installments.id }).from(installments).where(eq(installments.agreementId, agreementId)).for("update")

    const [latest] = await tx
      .select()
      .from(payments)
      .where(eq(payments.agreementId, agreementId))
      .orderBy(desc(payments.createdAt))
      .limit(1)
    if (!latest || latest.id !== paymentId) {
      const exists = await tx.$count(payments, and(eq(payments.id, paymentId), eq(payments.agreementId, agreementId)))
      if (!exists) throw new HttpError(404, "Payment not found")
      throw new HttpError(409, "Only the most recent payment can be reversed. Reverse newer payments first.")
    }

    const allocations = await tx.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, paymentId))
    for (const allocation of allocations) await applyAllocation(tx, allocation, -1)
    await tx.delete(payments).where(eq(payments.id, paymentId))
    return latest.receiptKey
  })
  await deleteStoredFile(receiptKey)
}

export async function readReceipt(scope: string | null, paymentId: string) {
  const [row] = await db.select().from(payments).where(eq(payments.id, paymentId))
  if (!row) throw new HttpError(404, "Payment not found")
  await assertAgreementInScope(scope, row.agreementId)
  return { row, body: await readStoredFile(row.receiptKey) }
}

const buyer = alias(customers, "buyer")
const seller = alias(customers, "seller")

const sortable = { paidOn: payments.paidOn, amount: payments.amount, createdAt: payments.createdAt }

/** `scope`: the staff user's dealership, or `null` for the super admin. */
export async function listPayments(scope: string | null, url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(url, sortable, "paidOn.desc")
  const from = dateParam(url, "from")
  const to = dateParam(url, "to")
  const minAmount = numberParam(url, "minAmount")
  const maxAmount = numberParam(url, "maxAmount")
  const where = and(
    dealershipScope(agreements.dealershipId, scope, url),
    from ? gte(payments.paidOn, from) : undefined,
    to ? lte(payments.paidOn, to) : undefined,
    minAmount !== undefined ? gte(payments.amount, minAmount) : undefined,
    maxAmount !== undefined ? lte(payments.amount, maxAmount) : undefined,
    q
      ? allWordsMatch(q.replace(/^[a-z]{2,5}-(?=\d)/i, ""), [sql`${agreements.number}::text`, buyer.name, seller.name, payments.notes])
      : undefined,
  )

  const base = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(payments)
      .innerJoin(agreements, eq(agreements.id, payments.agreementId))
      .innerJoin(dealerships, eq(dealerships.id, agreements.dealershipId))
      .innerJoin(installments, eq(installments.id, payments.installmentId))
      .innerJoin(cars, eq(cars.id, agreements.carId))
      .leftJoin(buyer, eq(buyer.id, agreements.customerId))
      .leftJoin(seller, eq(seller.id, agreements.sellerId))
      .where(where)

  const [rows, [total]] = await Promise.all([
    base({
      id: payments.id,
      agreementId: payments.agreementId,
      agreementNumber: agreements.number,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      customerName: sql<string>`coalesce(${buyer.name}, ${seller.name})`,
      carTitle: sql<string>`${cars.year} || ' ' || ${cars.brand} || ' ' || ${cars.name}`,
      installmentSequence: installments.sequence,
      amount: payments.amount,
      paidOn: payments.paidOn,
      notes: payments.notes,
      receiptName: payments.receiptName,
      createdAt: payments.createdAt,
      carried: sql<number>`coalesce((select sum(${paymentAllocations.amount}) from ${paymentAllocations} where ${paymentAllocations.paymentId} = ${payments.id} and ${paymentAllocations.kind} = 'carry_out'), 0)`.mapWith(Number),
      paidAhead: sql<number>`coalesce((select sum(${paymentAllocations.amount}) from ${paymentAllocations} where ${paymentAllocations.paymentId} = ${payments.id} and ${paymentAllocations.kind} = 'paid' and ${paymentAllocations.installmentId} <> ${payments.installmentId}), 0)`.mapWith(Number),
    })
      .orderBy(orderBy, desc(payments.createdAt))
      .limit(perPage)
      .offset(offset) as Promise<PaymentListRow[]>,
    base({ value: count() }) as Promise<{ value: number }[]>,
  ])
  return { rows, rowCount: total?.value ?? 0 }
}

export type PaymentListRow = {
  id: string
  agreementId: string
  agreementNumber: number
  dealershipCode: string
  dealershipName: string
  customerName: string
  carTitle: string
  installmentSequence: number
  amount: number
  paidOn: string
  notes: string | null
  receiptName: string
  createdAt: Date
  carried: number
  paidAhead: number
}

export async function paymentTotals(scope: string | null) {
  const monthStart = sql`date_trunc('month', (now() at time zone 'Africa/Nairobi'))::date`
  const [row] = await db
    .select({
      thisMonth: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.paidOn} >= ${monthStart}), 0)`.mapWith(Number),
      allTime: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
      countThisMonth: sql<number>`count(*) filter (where ${payments.paidOn} >= ${monthStart})`.mapWith(Number),
    })
    .from(payments)
    .innerJoin(agreements, eq(agreements.id, payments.agreementId))
    .where(scope ? eq(agreements.dealershipId, scope) : undefined)
  return row ?? { thisMonth: 0, allTime: 0, countThisMonth: 0 }
}

