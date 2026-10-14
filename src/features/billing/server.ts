import "server-only"

import { format, startOfMonth, subDays, subMonths } from "date-fns"
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import {
  billingAccounts,
  billingEvents,
  billingInvoices,
  billingPlans,
  billingTransactions,
  dealerships,
  subscriptions,
  subscriptionStatus,
  billingInvoiceStatus,
  billingTransactionStatus,
} from "@/db/schema"
import { HttpError } from "@/server/http"
import { allWordsMatch, dateParam, dealershipScope, enumListParam, numberParam, parseListParams } from "@/server/list-params"

import { LIVE_SUBSCRIPTION_STATUSES, monthlyAmount } from "./meta"
import { billingMode, configuredProvider, providerFor } from "./provider"

const liveStatus = notInArray(subscriptions.status, ["canceled", "incomplete_expired"])
const nairobiDate = (column: unknown) => sql`(${column} at time zone 'Africa/Nairobi')::date`
/** Money filters arrive in major units (what people type); the tables store minor units. */
const minor = (value: number | undefined) => (value === undefined ? undefined : Math.round(value * 100))

// ─── Plans ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export const planSchema = z.object({
  name: z.string().trim().min(2, "Enter a plan name").max(40),
  description: z.string().trim().max(200).default(""),
  /** Major units in the form; stored as minor units. */
  price: z.coerce.number().positive("Price must be more than 0").max(10_000_000),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/, "3-letter currency code, e.g. kes"),
  interval: z.enum(["month", "year"]),
  features: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  isActive: z.boolean().default(true),
  /** Set to make this a custom plan only that dealership can see. Only honoured when creating. */
  dealershipId: z.uuid().nullable().optional(),
})
export type PlanFormValues = z.input<typeof planSchema>

export const planConstraintMessages = {}

/**
 * Plans. With no `dealershipId` this is every plan (super admin). With one it is what that dealership can see: the public
 * plans plus its own custom plans.
 */
export async function listPlans({ activeOnly, dealershipId }: { activeOnly: boolean; dealershipId?: string }) {
  const subscribers = db
    .select({ planId: subscriptions.planId, value: count().as("value") })
    .from(subscriptions)
    .where(liveStatus)
    .groupBy(subscriptions.planId)
    .as("s")
  return db
    .select({
      id: billingPlans.id,
      code: billingPlans.code,
      dealershipId: billingPlans.dealershipId,
      dealershipName: dealerships.name,
      name: billingPlans.name,
      description: billingPlans.description,
      amount: billingPlans.amount,
      currency: billingPlans.currency,
      interval: billingPlans.interval,
      features: billingPlans.features,
      isActive: billingPlans.isActive,
      sortOrder: billingPlans.sortOrder,
      stripePriceId: billingPlans.stripePriceId,
      subscribers: sql<number>`coalesce(${subscribers.value}, 0)`.mapWith(Number),
    })
    .from(billingPlans)
    .leftJoin(subscribers, eq(subscribers.planId, billingPlans.id))
    .leftJoin(dealerships, eq(dealerships.id, billingPlans.dealershipId))
    .where(
      and(
        activeOnly ? eq(billingPlans.isActive, true) : undefined,
        dealershipId ? or(isNull(billingPlans.dealershipId), eq(billingPlans.dealershipId, dealershipId)) : undefined,
      ),
    )
    // Public plans first, then custom ones.
    .orderBy(sql`${billingPlans.dealershipId} is not null`, asc(billingPlans.sortOrder), asc(billingPlans.amount))
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "plan"

/** Plan codes are an internal identifier (Stripe metadata); generate one from the name instead of asking for it. */
async function uniquePlanCode(name: string, dealershipId: string | null) {
  let prefix = ""
  if (dealershipId) {
    const [d] = await db.select({ code: dealerships.code }).from(dealerships).where(eq(dealerships.id, dealershipId))
    prefix = `custom-${d?.code.toLowerCase() ?? "x"}-`
  }
  const base = `${prefix}${slug(name)}`
  for (let n = 1; n < 50; n++) {
    const code = n === 1 ? base : `${base}-${n}`
    if ((await db.$count(billingPlans, eq(billingPlans.code, code))) === 0) return code
  }
  throw new HttpError(409, "Couldn't generate a unique plan code. Try a different name.")
}

export async function savePlan(id: string | null, input: z.output<typeof planSchema>) {
  const { price, dealershipId, ...rest } = input
  const amount = Math.round(price * 100)
  if (!id) {
    if (dealershipId && (await db.$count(dealerships, eq(dealerships.id, dealershipId))) === 0) throw new HttpError(404, "Dealership not found")
    const [{ value: maxOrder } = { value: 0 }] = await db.select({ value: sql<number>`coalesce(max(${billingPlans.sortOrder}), 0)`.mapWith(Number) }).from(billingPlans)
    const code = await uniquePlanCode(rest.name, dealershipId ?? null)
    const [row] = await db
      .insert(billingPlans)
      .values({ ...rest, code, dealershipId: dealershipId ?? null, amount, sortOrder: maxOrder + 1 })
      .returning()
    return row!
  }
  const [current] = await db.select().from(billingPlans).where(eq(billingPlans.id, id))
  if (!current) throw new HttpError(404, "Plan not found")
  const priceChanged = current.amount !== amount || current.currency !== rest.currency || current.interval !== rest.interval
  const [row] = await db
    .update(billingPlans)
    // Stripe prices are immutable: forget the old one so the next checkout creates the new price. Existing
    // subscriptions keep paying what they signed up for until their plan is changed.
    .set({ ...rest, amount, ...(priceChanged ? { stripePriceId: null } : {}) })
    .where(eq(billingPlans.id, id))
    .returning()
  return row!
}

/** A dealership may only use public plans and its own custom plans, never another dealership's. */
async function planForDealership(planId: string, dealershipId: string, { allowInactive }: { allowInactive: boolean }) {
  const [plan] = await db.select().from(billingPlans).where(eq(billingPlans.id, planId))
  const visible = plan && (!plan.dealershipId || plan.dealershipId === dealershipId) && (allowInactive || plan.isActive)
  if (!visible) throw new HttpError(404, "That plan is not available")
  return plan
}

export async function deletePlan(id: string) {
  const used = await db.$count(subscriptions, eq(subscriptions.planId, id))
  if (used > 0) throw new HttpError(409, "This plan has subscriptions. Deactivate it instead so no one new can choose it.")
  const deleted = await db.delete(billingPlans).where(eq(billingPlans.id, id)).returning({ id: billingPlans.id })
  if (!deleted.length) throw new HttpError(404, "Plan not found")
}

// ─── Staff: this dealership's billing ────────────────────────────────────────────────────────────────────────────────

async function liveSubscription(dealershipId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.dealershipId, dealershipId), liveStatus))
    .orderBy(desc(subscriptions.createdAt))
  return row
}

export async function getBillingSummary(dealershipId: string) {
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.dealershipId, dealershipId))
  const [current] = await db
    .select({ sub: subscriptions, planName: billingPlans.name })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(billingPlans.id, subscriptions.planId))
    .where(eq(subscriptions.dealershipId, dealershipId))
    // The live subscription if there is one, otherwise the most recent (so a canceled one still shows).
    .orderBy(sql`${liveStatus} desc`, desc(subscriptions.createdAt))
    .limit(1)
  const [plans, invoices, transactions] = await Promise.all([
    listPlans({ activeOnly: true, dealershipId }),
    db
      .select()
      .from(billingInvoices)
      .where(eq(billingInvoices.dealershipId, dealershipId))
      .orderBy(desc(billingInvoices.issuedAt))
      .limit(24),
    db
      .select()
      .from(billingTransactions)
      .where(eq(billingTransactions.dealershipId, dealershipId))
      .orderBy(desc(billingTransactions.occurredAt))
      .limit(10),
  ])
  return {
    mode: billingMode(),
    account: account
      ? {
          email: account.email,
          provider: account.provider,
          cardBrand: account.cardBrand,
          cardLast4: account.cardLast4,
          cardExpMonth: account.cardExpMonth,
          cardExpYear: account.cardExpYear,
          sandboxCardDeclines: account.sandboxCardDeclines,
        }
      : null,
    subscription: current ? { ...current.sub, planName: current.planName } : null,
    plans,
    invoices,
    transactions,
  }
}
export type BillingSummary = Awaited<ReturnType<typeof getBillingSummary>>

/** Lightweight status for the staff app's warning banner. */
export async function billingStatus(dealershipId: string) {
  const sub = await liveSubscription(dealershipId)
  return { status: sub?.status ?? null, cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false, currentPeriodEnd: sub?.currentPeriodEnd ?? null }
}

async function loadDealership(dealershipId: string) {
  const [dealership] = await db.select().from(dealerships).where(eq(dealerships.id, dealershipId))
  if (!dealership) throw new HttpError(404, "Dealership not found")
  return dealership
}

export async function startCheckout(dealershipId: string, planId: string, origin: string) {
  const plan = await planForDealership(planId, dealershipId, { allowInactive: false })
  if (await liveSubscription(dealershipId)) throw new HttpError(409, "You already have a subscription. Change your plan instead.")
  const provider = await providerFor(configuredProvider())
  return provider.startCheckout({ dealership: await loadDealership(dealershipId), plan, origin })
}

export async function portalUrl(dealershipId: string, origin: string) {
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.dealershipId, dealershipId))
  const provider = await providerFor(account?.provider ?? configuredProvider())
  return provider.portalUrl({ dealership: await loadDealership(dealershipId), origin })
}

// ─── Actions shared by staff (own dealership) and super admin (any) ─────────────────────────────────────────────────

async function subscriptionInScope(scope: string | null, id: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), scope ? eq(subscriptions.dealershipId, scope) : undefined))
  if (!sub) throw new HttpError(404, "Subscription not found")
  return sub
}

export const subscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_plan"), planId: z.uuid() }),
  z.object({ action: z.literal("cancel"), atPeriodEnd: z.boolean() }),
  z.object({ action: z.literal("resume") }),
])

export async function updateSubscription(scope: string | null, id: string, input: z.output<typeof subscriptionActionSchema>) {
  const sub = await subscriptionInScope(scope, id)
  if (sub.status === "canceled") throw new HttpError(409, "This subscription has ended. Start a new one from the billing page.")
  const provider = await providerFor(sub.provider)
  if (input.action === "change_plan") {
    // Staff can only pick active plans visible to them; the super admin may move a dealership onto any plan that is
    // public or custom-made for that same dealership (including inactive ones).
    const plan = await planForDealership(input.planId, sub.dealershipId, { allowInactive: !scope })
    if (plan.id === sub.planId) throw new HttpError(409, "Already on this plan")
    await provider.changePlan(sub, plan)
  } else if (input.action === "cancel") {
    await provider.cancel(sub, input.atPeriodEnd)
  } else {
    if (!sub.cancelAtPeriodEnd) throw new HttpError(409, "This subscription is not set to cancel")
    await provider.resume(sub)
  }
  return subscriptionInScope(scope, id)
}

export async function payInvoice(scope: string | null, id: string) {
  const [invoice] = await db
    .select()
    .from(billingInvoices)
    .where(and(eq(billingInvoices.id, id), scope ? eq(billingInvoices.dealershipId, scope) : undefined))
  if (!invoice) throw new HttpError(404, "Invoice not found")
  if (invoice.status !== "open") throw new HttpError(409, "Only open invoices can be paid")
  return (await providerFor(invoice.provider)).retryInvoice(invoice)
}

export async function voidInvoice(id: string) {
  const [invoice] = await db.select().from(billingInvoices).where(eq(billingInvoices.id, id))
  if (!invoice) throw new HttpError(404, "Invoice not found")
  await (await providerFor(invoice.provider)).voidInvoice(invoice)
}

export async function refundTransaction(id: string) {
  const [transaction] = await db.select().from(billingTransactions).where(eq(billingTransactions.id, id))
  if (!transaction) throw new HttpError(404, "Transaction not found")
  if (transaction.status !== "succeeded" && transaction.status !== "partially_refunded") {
    throw new HttpError(409, "Only successful payments can be refunded")
  }
  await (await providerFor(transaction.provider)).refund(transaction)
}

// ─── Admin lists ─────────────────────────────────────────────────────────────────────────────────────────────────────

export async function listSubscriptions(url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(
    url,
    { createdAt: subscriptions.createdAt, currentPeriodEnd: subscriptions.currentPeriodEnd, amount: subscriptions.amount },
    "createdAt.desc",
  )
  const statuses = enumListParam(url, "status", subscriptionStatus.enumValues)
  const plans = enumListParam(url, "plan", (await db.select({ id: billingPlans.id }).from(billingPlans)).map((p) => p.id))
  const where = and(
    dealershipScope(subscriptions.dealershipId, null, url),
    statuses.length ? inArray(subscriptions.status, statuses) : undefined,
    plans.length ? inArray(subscriptions.planId, plans) : undefined,
    q ? allWordsMatch(q, [dealerships.name, dealerships.code, billingPlans.name, subscriptions.providerSubscriptionId]) : undefined,
  )
  const base = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(subscriptions)
      .innerJoin(dealerships, eq(dealerships.id, subscriptions.dealershipId))
      .innerJoin(billingPlans, eq(billingPlans.id, subscriptions.planId))
      .where(where)
  const [rows, [total]] = await Promise.all([
    base({
      id: subscriptions.id,
      dealershipId: subscriptions.dealershipId,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      planId: subscriptions.planId,
      planName: billingPlans.name,
      provider: subscriptions.provider,
      providerSubscriptionId: subscriptions.providerSubscriptionId,
      status: subscriptions.status,
      amount: subscriptions.amount,
      currency: subscriptions.currency,
      interval: subscriptions.interval,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      canceledAt: subscriptions.canceledAt,
      createdAt: subscriptions.createdAt,
      openBalance: sql<number>`coalesce((select sum(${billingInvoices.amountRemaining}) from ${billingInvoices} where ${billingInvoices.subscriptionId} = ${subscriptions.id} and ${billingInvoices.status} = 'open'), 0)`.mapWith(Number),
    })
      .orderBy(orderBy, subscriptions.id)
      .limit(perPage)
      .offset(offset) as Promise<SubscriptionListRow[]>,
    base({ value: count() }) as Promise<{ value: number }[]>,
  ])
  return { rows, rowCount: total?.value ?? 0 }
}

export type SubscriptionListRow = {
  id: string
  dealershipId: string
  dealershipCode: string
  dealershipName: string
  planId: string
  planName: string
  provider: "stripe" | "sandbox"
  providerSubscriptionId: string
  status: (typeof subscriptionStatus.enumValues)[number]
  amount: number
  currency: string
  interval: "month" | "year"
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  createdAt: Date
  openBalance: number
}

export async function listBillingInvoices(url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(
    url,
    { issuedAt: billingInvoices.issuedAt, amountDue: billingInvoices.amountDue, dueDate: billingInvoices.dueDate },
    "issuedAt.desc",
  )
  const statuses = enumListParam(url, "status", billingInvoiceStatus.enumValues)
  const from = dateParam(url, "from")
  const to = dateParam(url, "to")
  const min = minor(numberParam(url, "minAmount"))
  const max = minor(numberParam(url, "maxAmount"))
  const where = and(
    dealershipScope(billingInvoices.dealershipId, null, url),
    statuses.length ? inArray(billingInvoices.status, statuses) : undefined,
    from ? gte(nairobiDate(billingInvoices.issuedAt), from) : undefined,
    to ? lte(nairobiDate(billingInvoices.issuedAt), to) : undefined,
    min !== undefined ? gte(billingInvoices.amountDue, min) : undefined,
    max !== undefined ? lte(billingInvoices.amountDue, max) : undefined,
    q ? allWordsMatch(q, [dealerships.name, dealerships.code, billingInvoices.number, billingInvoices.providerInvoiceId]) : undefined,
  )
  const base = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(billingInvoices)
      .innerJoin(dealerships, eq(dealerships.id, billingInvoices.dealershipId))
      .where(where)
  const [rows, [total]] = await Promise.all([
    base({
      id: billingInvoices.id,
      dealershipId: billingInvoices.dealershipId,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      provider: billingInvoices.provider,
      providerInvoiceId: billingInvoices.providerInvoiceId,
      number: billingInvoices.number,
      status: billingInvoices.status,
      description: billingInvoices.description,
      amountDue: billingInvoices.amountDue,
      amountPaid: billingInvoices.amountPaid,
      amountRemaining: billingInvoices.amountRemaining,
      currency: billingInvoices.currency,
      periodStart: billingInvoices.periodStart,
      periodEnd: billingInvoices.periodEnd,
      dueDate: billingInvoices.dueDate,
      paidAt: billingInvoices.paidAt,
      attemptCount: billingInvoices.attemptCount,
      nextPaymentAttempt: billingInvoices.nextPaymentAttempt,
      hostedInvoiceUrl: billingInvoices.hostedInvoiceUrl,
      invoicePdfUrl: billingInvoices.invoicePdfUrl,
      issuedAt: billingInvoices.issuedAt,
    })
      .orderBy(orderBy, billingInvoices.id)
      .limit(perPage)
      .offset(offset),
    base({ value: count() }) as Promise<{ value: number }[]>,
  ])
  return { rows: rows as BillingInvoiceListRow[], rowCount: total?.value ?? 0 }
}

export type BillingInvoiceListRow = typeof billingInvoices.$inferSelect & { dealershipCode: string; dealershipName: string }

export async function listBillingTransactions(url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(
    url,
    { occurredAt: billingTransactions.occurredAt, amount: billingTransactions.amount },
    "occurredAt.desc",
  )
  const statuses = enumListParam(url, "status", billingTransactionStatus.enumValues)
  const from = dateParam(url, "from")
  const to = dateParam(url, "to")
  const min = minor(numberParam(url, "minAmount"))
  const max = minor(numberParam(url, "maxAmount"))
  const where = and(
    dealershipScope(billingTransactions.dealershipId, null, url),
    statuses.length ? inArray(billingTransactions.status, statuses) : undefined,
    from ? gte(nairobiDate(billingTransactions.occurredAt), from) : undefined,
    to ? lte(nairobiDate(billingTransactions.occurredAt), to) : undefined,
    min !== undefined ? gte(billingTransactions.amount, min) : undefined,
    max !== undefined ? lte(billingTransactions.amount, max) : undefined,
    q
      ? allWordsMatch(q, [
          dealerships.name,
          dealerships.code,
          billingInvoices.number,
          billingTransactions.providerTransactionId,
          billingTransactions.cardLast4,
          billingTransactions.failureMessage,
        ])
      : undefined,
  )
  const base = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(billingTransactions)
      .innerJoin(dealerships, eq(dealerships.id, billingTransactions.dealershipId))
      .leftJoin(billingInvoices, eq(billingInvoices.id, billingTransactions.invoiceId))
      .where(where)
  const [rows, [total]] = await Promise.all([
    base({
      id: billingTransactions.id,
      dealershipId: billingTransactions.dealershipId,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      invoiceId: billingTransactions.invoiceId,
      invoiceNumber: billingInvoices.number,
      provider: billingTransactions.provider,
      providerTransactionId: billingTransactions.providerTransactionId,
      status: billingTransactions.status,
      amount: billingTransactions.amount,
      amountRefunded: billingTransactions.amountRefunded,
      fee: billingTransactions.fee,
      currency: billingTransactions.currency,
      cardBrand: billingTransactions.cardBrand,
      cardLast4: billingTransactions.cardLast4,
      failureCode: billingTransactions.failureCode,
      failureMessage: billingTransactions.failureMessage,
      receiptUrl: billingTransactions.receiptUrl,
      occurredAt: billingTransactions.occurredAt,
    })
      .orderBy(orderBy, billingTransactions.id)
      .limit(perPage)
      .offset(offset),
    base({ value: count() }) as Promise<{ value: number }[]>,
  ])
  return { rows: rows as BillingTransactionListRow[], rowCount: total?.value ?? 0 }
}

export type BillingTransactionListRow = typeof billingTransactions.$inferSelect & {
  dealershipCode: string
  dealershipName: string
  invoiceNumber: string | null
}

export async function listBillingEvents(url: string) {
  const { perPage, offset, orderBy } = parseListParams(url, { receivedAt: billingEvents.receivedAt }, "receivedAt.desc")
  const [rows, rowCount] = await Promise.all([
    db
      .select({
        id: billingEvents.id,
        provider: billingEvents.provider,
        type: billingEvents.type,
        summary: billingEvents.summary,
        error: billingEvents.error,
        receivedAt: billingEvents.receivedAt,
        processedAt: billingEvents.processedAt,
        dealershipCode: dealerships.code,
      })
      .from(billingEvents)
      .leftJoin(dealerships, eq(dealerships.id, billingEvents.dealershipId))
      .orderBy(orderBy)
      .limit(perPage)
      .offset(offset),
    db.$count(billingEvents),
  ])
  return { rows, rowCount }
}

// ─── Admin revenue overview ──────────────────────────────────────────────────────────────────────────────────────────

/** Net collected = charged minus refunded, by the month the charge happened. */
const netCollected = sql<number>`coalesce(sum(${billingTransactions.amount} - ${billingTransactions.amountRefunded}) filter (where ${billingTransactions.status} in ('succeeded', 'refunded', 'partially_refunded')), 0)`

export async function getRevenueOverview() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const trendStart = startOfMonth(subMonths(now, 11))

  const [live, openInvoices, [thisMonth], [lastMonth], trendRows, [failures], churned, recentFailures, recentEvents, [currencyRow]] =
    await Promise.all([
      db
        .select({ sub: subscriptions, planName: billingPlans.name })
        .from(subscriptions)
        .innerJoin(billingPlans, eq(billingPlans.id, subscriptions.planId))
        .where(inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])),
      db
        .select({ amount: sql<number>`coalesce(sum(${billingInvoices.amountRemaining}), 0)`.mapWith(Number), value: count() })
        .from(billingInvoices)
        .where(eq(billingInvoices.status, "open")),
      db.select({ value: netCollected.mapWith(Number) }).from(billingTransactions).where(gte(billingTransactions.occurredAt, monthStart)),
      db
        .select({ value: netCollected.mapWith(Number) })
        .from(billingTransactions)
        .where(and(gte(billingTransactions.occurredAt, startOfMonth(subMonths(now, 1))), lt(billingTransactions.occurredAt, monthStart))),
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${billingTransactions.occurredAt} at time zone 'Africa/Nairobi'), 'YYYY-MM')`,
          collected: netCollected.mapWith(Number),
          refunded: sql<number>`coalesce(sum(${billingTransactions.amountRefunded}), 0)`.mapWith(Number),
          failed: sql<number>`count(*) filter (where ${billingTransactions.status} = 'failed')`.mapWith(Number),
        })
        .from(billingTransactions)
        .where(gte(billingTransactions.occurredAt, trendStart))
        .groupBy(sql`1`),
      db
        .select({ value: count() })
        .from(billingTransactions)
        .where(and(eq(billingTransactions.status, "failed"), gte(billingTransactions.occurredAt, subDays(now, 30)))),
      db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.status, "canceled"), gte(subscriptions.canceledAt, subDays(now, 30)))),
      db
        .select({
          id: billingTransactions.id,
          amount: billingTransactions.amount,
          currency: billingTransactions.currency,
          failureMessage: billingTransactions.failureMessage,
          occurredAt: billingTransactions.occurredAt,
          dealershipCode: dealerships.code,
          dealershipName: dealerships.name,
        })
        .from(billingTransactions)
        .innerJoin(dealerships, eq(dealerships.id, billingTransactions.dealershipId))
        .where(eq(billingTransactions.status, "failed"))
        .orderBy(desc(billingTransactions.occurredAt))
        .limit(5),
      db
        .select({
          id: billingEvents.id,
          type: billingEvents.type,
          summary: billingEvents.summary,
          error: billingEvents.error,
          provider: billingEvents.provider,
          receivedAt: billingEvents.receivedAt,
          dealershipCode: dealerships.code,
        })
        .from(billingEvents)
        .leftJoin(dealerships, eq(dealerships.id, billingEvents.dealershipId))
        .orderBy(desc(billingEvents.receivedAt))
        .limit(8),
      db.select({ currency: billingPlans.currency }).from(billingPlans).orderBy(asc(billingPlans.sortOrder)).limit(1),
    ])

  const paying = live.filter(({ sub }) => sub.status !== "incomplete" && sub.status !== "paused")
  const mrr = paying.reduce((sum, { sub }) => sum + monthlyAmount(sub.amount, sub.interval), 0)
  const byPlan = new Map<string, { plan: string; subscriptions: number; mrr: number }>()
  for (const { sub, planName } of paying) {
    const entry = byPlan.get(planName) ?? { plan: planName, subscriptions: 0, mrr: 0 }
    entry.subscriptions++
    entry.mrr += monthlyAmount(sub.amount, sub.interval)
    byPlan.set(planName, entry)
  }
  const trendByMonth = new Map(trendRows.map((row) => [row.month, row]))
  const trend = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(monthStart, 11 - i)
    const row = trendByMonth.get(format(date, "yyyy-MM"))
    return { month: format(date, "MMM"), collected: row?.collected ?? 0, refunded: row?.refunded ?? 0, failed: row?.failed ?? 0 }
  })

  return {
    mode: billingMode(),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    currency: currencyRow?.currency ?? "kes",
    mrr,
    arr: mrr * 12,
    arpa: paying.length ? Math.round(mrr / paying.length) : 0,
    subscriptions: {
      active: live.filter(({ sub }) => sub.status === "active").length,
      trialing: live.filter(({ sub }) => sub.status === "trialing").length,
      pastDue: live.filter(({ sub }) => sub.status === "past_due" || sub.status === "unpaid").length,
      cancelingAtPeriodEnd: live.filter(({ sub }) => sub.cancelAtPeriodEnd).length,
      churned30d: churned.length,
    },
    outstanding: { amount: openInvoices[0]?.amount ?? 0, invoices: openInvoices[0]?.value ?? 0 },
    collectedThisMonth: thisMonth?.value ?? 0,
    collectedLastMonth: lastMonth?.value ?? 0,
    failedPayments30d: failures?.value ?? 0,
    plans: [...byPlan.values()].sort((a, b) => b.mrr - a.mrr),
    trend,
    recentFailures,
    recentEvents,
  }
}
export type RevenueOverview = Awaited<ReturnType<typeof getRevenueOverview>>

/** Base URL for provider redirects (Checkout success/cancel, portal return). APP_URL wins behind proxies. */
export const appOrigin = (request: Request) => process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin
