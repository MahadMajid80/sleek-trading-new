// Writes provider state into our billing tables. Every provider (Stripe webhooks, the sandbox, the seed) describes what
// it knows as a normalised snapshot and these upserts make the database match it. Upserts are keyed by the provider's
// own ids, so replaying the same event, or events arriving out of order, is harmless.
//
// Deliberately free of `server-only`/`@/` imports so the seed script and unit tests can use it without the Next runtime.

import { and, eq, sql } from "drizzle-orm"

import type { Database } from "../../db/client"
import {
  billingAccounts,
  billingEvents,
  billingInvoices,
  billingTransactions,
  subscriptions,
  type BillingInvoiceStatus,
  type BillingTransactionStatus,
  type SubscriptionStatus,
} from "../../db/schema"

export type Provider = "stripe" | "sandbox"
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]
export type Executor = Database | Tx

export type SubscriptionSnapshot = {
  provider: Provider
  providerSubscriptionId: string
  dealershipId: string
  planId: string
  status: SubscriptionStatus
  amount: number
  currency: string
  interval: "month" | "year"
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  trialEnd: Date | null
}

export type InvoiceSnapshot = {
  provider: Provider
  providerInvoiceId: string
  dealershipId: string
  providerSubscriptionId: string | null
  number: string | null
  status: BillingInvoiceStatus
  description: string | null
  amountDue: number
  amountPaid: number
  amountRemaining: number
  currency: string
  periodStart: Date | null
  periodEnd: Date | null
  dueDate: Date | null
  paidAt: Date | null
  attemptCount: number
  nextPaymentAttempt: Date | null
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  issuedAt: Date
}

export type TransactionSnapshot = {
  provider: Provider
  providerTransactionId: string
  dealershipId: string
  providerInvoiceId: string | null
  status: BillingTransactionStatus
  amount: number
  amountRefunded: number
  fee: number | null
  currency: string
  cardBrand: string | null
  cardLast4: string | null
  failureCode: string | null
  failureMessage: string | null
  receiptUrl: string | null
  occurredAt: Date
}

export type CardSnapshot = { brand: string; last4: string; expMonth: number | null; expYear: number | null }

export function transactionStatus(amount: number, refunded: number, base: "pending" | "succeeded" | "failed"): BillingTransactionStatus {
  if (base !== "succeeded" || refunded <= 0) return base
  return refunded >= amount ? "refunded" : "partially_refunded"
}

export async function upsertSubscription(db: Executor, s: SubscriptionSnapshot) {
  const values = { ...s }
  const [row] = await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [subscriptions.provider, subscriptions.providerSubscriptionId],
      set: {
        planId: s.planId,
        status: s.status,
        amount: s.amount,
        currency: s.currency,
        interval: s.interval,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        canceledAt: s.canceledAt,
        trialEnd: s.trialEnd,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row!
}

async function subscriptionIdFor(db: Executor, provider: Provider, providerSubscriptionId: string | null) {
  if (!providerSubscriptionId) return null
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, provider), eq(subscriptions.providerSubscriptionId, providerSubscriptionId)))
  return row?.id ?? null
}

export async function upsertInvoice(db: Executor, i: InvoiceSnapshot) {
  const { providerSubscriptionId, ...rest } = i
  const subscriptionId = await subscriptionIdFor(db, i.provider, providerSubscriptionId)
  const values = { ...rest, subscriptionId }
  const [row] = await db
    .insert(billingInvoices)
    .values(values)
    .onConflictDoUpdate({
      target: [billingInvoices.provider, billingInvoices.providerInvoiceId],
      set: { ...values, updatedAt: new Date() },
    })
    .returning()
  return row!
}

export async function upsertTransaction(db: Executor, t: TransactionSnapshot) {
  const { providerInvoiceId, ...rest } = t
  let invoiceId: string | null = null
  if (providerInvoiceId) {
    const [invoice] = await db
      .select({ id: billingInvoices.id })
      .from(billingInvoices)
      .where(and(eq(billingInvoices.provider, t.provider), eq(billingInvoices.providerInvoiceId, providerInvoiceId)))
    invoiceId = invoice?.id ?? null
  }
  const values = { ...rest, invoiceId }
  const [row] = await db
    .insert(billingTransactions)
    .values(values)
    .onConflictDoUpdate({
      target: [billingTransactions.provider, billingTransactions.providerTransactionId],
      set: {
        // A refund webhook doesn't know the invoice; keep the link we already have.
        invoiceId: sql`coalesce(excluded.invoice_id, ${billingTransactions.invoiceId})`,
        status: t.status,
        amount: t.amount,
        amountRefunded: t.amountRefunded,
        fee: sql`coalesce(excluded.fee, ${billingTransactions.fee})`,
        cardBrand: sql`coalesce(excluded.card_brand, ${billingTransactions.cardBrand})`,
        cardLast4: sql`coalesce(excluded.card_last4, ${billingTransactions.cardLast4})`,
        failureCode: t.failureCode,
        failureMessage: t.failureMessage,
        receiptUrl: sql`coalesce(excluded.receipt_url, ${billingTransactions.receiptUrl})`,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row!
}

export async function ensureBillingAccount(
  db: Executor,
  dealershipId: string,
  provider: Provider,
  values: { email?: string | null; providerCustomerId?: string | null } = {},
) {
  const [row] = await db
    .insert(billingAccounts)
    .values({ dealershipId, provider, ...values })
    .onConflictDoUpdate({
      target: billingAccounts.dealershipId,
      set: { provider, ...values, updatedAt: new Date() },
    })
    .returning()
  return row!
}

export async function setAccountCard(db: Executor, dealershipId: string, card: CardSnapshot | null) {
  await db
    .update(billingAccounts)
    .set({
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      cardExpMonth: card?.expMonth ?? null,
      cardExpYear: card?.expYear ?? null,
      updatedAt: new Date(),
    })
    .where(eq(billingAccounts.dealershipId, dealershipId))
}

export async function dealershipForCustomer(db: Executor, provider: Provider, providerCustomerId: string) {
  const [row] = await db
    .select({ dealershipId: billingAccounts.dealershipId })
    .from(billingAccounts)
    .where(and(eq(billingAccounts.provider, provider), eq(billingAccounts.providerCustomerId, providerCustomerId)))
  return row?.dealershipId ?? null
}

/**
 * Runs `handler` at most once per provider event id. A failed run records the error and is retried on redelivery;
 * a successful one is skipped.
 */
export async function processEventOnce(
  db: Executor,
  event: { id: string; provider: Provider; type: string; payload?: unknown },
  handler: () => Promise<{ dealershipId?: string | null; summary?: string } | void>,
) {
  const [inserted] = await db
    .insert(billingEvents)
    .values({ id: event.id, provider: event.provider, type: event.type, payload: event.payload ?? null })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id })
  if (!inserted) {
    const [existing] = await db.select({ processedAt: billingEvents.processedAt }).from(billingEvents).where(eq(billingEvents.id, event.id))
    if (existing?.processedAt) return { duplicate: true as const }
  }
  try {
    const result = await handler()
    await db
      .update(billingEvents)
      .set({ processedAt: new Date(), error: null, dealershipId: result?.dealershipId ?? null, summary: result?.summary ?? null })
      .where(eq(billingEvents.id, event.id))
    return { duplicate: false as const }
  } catch (error) {
    await db
      .update(billingEvents)
      .set({ error: error instanceof Error ? error.message : String(error) })
      .where(eq(billingEvents.id, event.id))
    throw error
  }
}
