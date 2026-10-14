import "server-only"

import { addDays, addMonths, addYears } from "date-fns"
import { and, eq, inArray, isNull, lt, notInArray, or } from "drizzle-orm"

import { db } from "@/db"
import {
  billingAccounts,
  billingInvoices,
  billingPlans,
  dealerships,
  subscriptions,
  type BillingInvoice,
  type BillingPlan,
  type Subscription,
} from "@/db/schema"
import { HttpError } from "@/server/http"

import type { BillingProvider } from "./provider"
import {
  ensureBillingAccount,
  processEventOnce,
  setAccountCard,
  upsertInvoice,
  upsertSubscription,
  upsertTransaction,
  type Executor,
  type InvoiceSnapshot,
  type SubscriptionSnapshot,
} from "./sync"

// A local stand-in for Stripe so the whole billing flow (checkout, renewals, failed cards, refunds, the webhook log)
// works with no keys. It drives the same snapshot upserts a real webhook would.

const rid = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`
const addInterval = (date: Date, interval: "month" | "year") => (interval === "year" ? addYears(date, 1) : addMonths(date, 1))
/** Simulated card processing fee: 2.9% + 30 (in the invoice currency's major unit). */
const sandboxFee = (amount: number) => Math.round(amount * 0.029) + 3000
const MAX_ATTEMPTS = 4

export const SANDBOX_CARDS = {
  approves: { brand: "visa", last4: "4242", expMonth: 12, expYear: new Date().getFullYear() + 3 },
  declines: { brand: "visa", last4: "0002", expMonth: 12, expYear: new Date().getFullYear() + 3 },
}

const subscriptionSnapshot = (row: Subscription): SubscriptionSnapshot => ({
  provider: "sandbox",
  providerSubscriptionId: row.providerSubscriptionId,
  dealershipId: row.dealershipId,
  planId: row.planId,
  status: row.status,
  amount: row.amount,
  currency: row.currency,
  interval: row.interval,
  currentPeriodStart: row.currentPeriodStart,
  currentPeriodEnd: row.currentPeriodEnd,
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  canceledAt: row.canceledAt,
  trialEnd: row.trialEnd,
})

const invoiceSnapshot = (row: BillingInvoice, providerSubscriptionId: string | null): InvoiceSnapshot => ({
  provider: "sandbox",
  providerInvoiceId: row.providerInvoiceId,
  dealershipId: row.dealershipId,
  providerSubscriptionId,
  number: row.number,
  status: row.status,
  description: row.description,
  amountDue: row.amountDue,
  amountPaid: row.amountPaid,
  amountRemaining: row.amountRemaining,
  currency: row.currency,
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  dueDate: row.dueDate,
  paidAt: row.paidAt,
  attemptCount: row.attemptCount,
  nextPaymentAttempt: row.nextPaymentAttempt,
  hostedInvoiceUrl: row.hostedInvoiceUrl,
  invoicePdfUrl: row.invoicePdfUrl,
  issuedAt: row.issuedAt,
})

async function lockAccount(tx: Executor, dealershipId: string) {
  const [account] = await tx
    .select()
    .from(billingAccounts)
    .where(eq(billingAccounts.dealershipId, dealershipId))
    .for("update")
  return account
}

async function nextInvoiceNumber(tx: Executor, dealershipId: string) {
  const [dealership] = await tx.select({ code: dealerships.code }).from(dealerships).where(eq(dealerships.id, dealershipId))
  const count = await tx.$count(billingInvoices, eq(billingInvoices.dealershipId, dealershipId))
  return `${dealership!.code}-${String(count + 1).padStart(4, "0")}`
}

/** Opens an invoice for a subscription period and immediately tries the card on file, like Stripe's auto-charge. */
async function invoiceAndCharge(
  tx: Executor,
  input: { subscription: SubscriptionSnapshot; plan: Pick<BillingPlan, "name">; periodStart: Date; periodEnd: Date; declines: boolean; reason: string },
) {
  const now = new Date()
  const invoice: InvoiceSnapshot = {
    provider: "sandbox",
    providerInvoiceId: rid("sbx_in"),
    dealershipId: input.subscription.dealershipId,
    providerSubscriptionId: input.subscription.providerSubscriptionId,
    number: await nextInvoiceNumber(tx, input.subscription.dealershipId),
    status: "open",
    description: `${input.plan.name} plan · ${input.reason}`,
    amountDue: input.subscription.amount,
    amountPaid: 0,
    amountRemaining: input.subscription.amount,
    currency: input.subscription.currency,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dueDate: now,
    paidAt: null,
    attemptCount: 0,
    nextPaymentAttempt: now,
    hostedInvoiceUrl: null,
    invoicePdfUrl: null,
    issuedAt: now,
  }
  await upsertInvoice(tx, invoice)
  return chargeInvoice(tx, invoice, input.declines)
}

async function chargeInvoice(tx: Executor, invoice: InvoiceSnapshot, declines: boolean) {
  const now = new Date()
  const card = declines ? SANDBOX_CARDS.declines : SANDBOX_CARDS.approves
  await upsertTransaction(tx, {
    provider: "sandbox",
    providerTransactionId: rid("sbx_ch"),
    dealershipId: invoice.dealershipId,
    providerInvoiceId: invoice.providerInvoiceId,
    status: declines ? "failed" : "succeeded",
    amount: invoice.amountRemaining,
    amountRefunded: 0,
    fee: declines ? null : sandboxFee(invoice.amountRemaining),
    currency: invoice.currency,
    cardBrand: card.brand,
    cardLast4: card.last4,
    failureCode: declines ? "card_declined" : null,
    failureMessage: declines ? "Your card was declined." : null,
    receiptUrl: null,
    occurredAt: now,
  })
  const attempts = invoice.attemptCount + 1
  const next: InvoiceSnapshot = declines
    ? { ...invoice, attemptCount: attempts, nextPaymentAttempt: attempts >= MAX_ATTEMPTS ? null : addDays(now, 3) }
    : { ...invoice, status: "paid", amountPaid: invoice.amountDue, amountRemaining: 0, paidAt: now, attemptCount: attempts, nextPaymentAttempt: null }
  await upsertInvoice(tx, next)
  return { paid: !declines, attempts }
}

async function subscriptionRow(tx: Executor, providerSubscriptionId: string) {
  const [row] = await tx
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, "sandbox"), eq(subscriptions.providerSubscriptionId, providerSubscriptionId)))
  return row!
}

/** Past due while any invoice is open; unpaid once retries are exhausted; active again when settled. */
async function refreshSubscriptionStatus(tx: Executor, subscriptionId: string) {
  const [row] = await tx.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId))
  if (!row || row.status === "canceled") return
  const open = await tx
    .select({ attemptCount: billingInvoices.attemptCount })
    .from(billingInvoices)
    .where(and(eq(billingInvoices.subscriptionId, subscriptionId), eq(billingInvoices.status, "open")))
  const status = open.length === 0 ? "active" : open.some((i) => i.attemptCount >= MAX_ATTEMPTS) ? "unpaid" : "past_due"
  if (status !== row.status) await upsertSubscription(tx, { ...subscriptionSnapshot(row), status })
}

const sandboxEvent = (type: string) => ({ id: rid("sbx_evt"), provider: "sandbox" as const, type })

// ─── Checkout & card (called from the sandbox checkout page / billing page) ──────────────────────────────────────────

export async function completeSandboxCheckout(dealershipId: string, planId: string, outcome: "approves" | "declines") {
  if (outcome === "declines") throw new HttpError(402, "Your card was declined. Try the test card that approves.")
  // Public plans, or a custom plan made for this very dealership.
  const [plan] = await db
    .select()
    .from(billingPlans)
    .where(
      and(
        eq(billingPlans.id, planId),
        eq(billingPlans.isActive, true),
        or(isNull(billingPlans.dealershipId), eq(billingPlans.dealershipId, dealershipId)),
      ),
    )
  if (!plan) throw new HttpError(404, "That plan is no longer available")

  await processEventOnce(db, sandboxEvent("checkout.session.completed"), () =>
    db.transaction(async (tx) => {
      await ensureBillingAccount(tx, dealershipId, "sandbox", { providerCustomerId: `sbx_cus_${dealershipId.slice(0, 8)}` })
      await lockAccount(tx, dealershipId)
      const [live] = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.dealershipId, dealershipId), notInArray(subscriptions.status, ["canceled", "incomplete_expired"])))
      if (live) throw new HttpError(409, "This dealership already has a subscription. Change plan instead.")

      await tx.update(billingAccounts).set({ sandboxCardDeclines: false }).where(eq(billingAccounts.dealershipId, dealershipId))
      await setAccountCard(tx, dealershipId, SANDBOX_CARDS.approves)
      const now = new Date()
      const snapshot: SubscriptionSnapshot = {
        provider: "sandbox",
        providerSubscriptionId: rid("sbx_sub"),
        dealershipId,
        planId: plan.id,
        status: "active",
        amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        currentPeriodStart: now,
        currentPeriodEnd: addInterval(now, plan.interval),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
      }
      await upsertSubscription(tx, snapshot)
      await invoiceAndCharge(tx, { subscription: snapshot, plan, periodStart: now, periodEnd: snapshot.currentPeriodEnd, declines: false, reason: "first payment" })
      return { dealershipId, summary: `Subscribed to ${plan.name}` }
    }),
  )
}

export async function setSandboxCard(dealershipId: string, declines: boolean) {
  await processEventOnce(db, sandboxEvent("payment_method.updated"), async () => {
    await ensureBillingAccount(db, dealershipId, "sandbox", { providerCustomerId: `sbx_cus_${dealershipId.slice(0, 8)}` })
    await db.update(billingAccounts).set({ sandboxCardDeclines: declines }).where(eq(billingAccounts.dealershipId, dealershipId))
    await setAccountCard(db, dealershipId, declines ? SANDBOX_CARDS.declines : SANDBOX_CARDS.approves)
    return { dealershipId, summary: declines ? "Card on file set to test card that declines" : "Card on file set to test card that approves" }
  })
}

// ─── Renewals (admin "run billing cycle" tool) ───────────────────────────────────────────────────────────────────────

/**
 * Simulates the passage of a billing period. With `force`, every live sandbox subscription renews now instead of only
 * those whose period has ended. Open invoices with retries left are retried as well.
 */
export async function runSandboxRenewals({ force }: { force: boolean }) {
  const now = new Date()
  const due = await db
    .select({ sub: subscriptions, plan: billingPlans, declines: billingAccounts.sandboxCardDeclines })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(billingPlans.id, subscriptions.planId))
    .leftJoin(billingAccounts, eq(billingAccounts.dealershipId, subscriptions.dealershipId))
    .where(
      and(
        eq(subscriptions.provider, "sandbox"),
        inArray(subscriptions.status, ["active", "trialing", "past_due"]),
        force ? undefined : lt(subscriptions.currentPeriodEnd, now),
      ),
    )

  const result = { renewed: 0, paid: 0, failed: 0, canceled: 0, retried: 0 }
  for (const { sub, plan, declines } of due) {
    await processEventOnce(db, sandboxEvent("invoice.created"), () =>
      db.transaction(async (tx) => {
        await lockAccount(tx, sub.dealershipId)
        if (sub.cancelAtPeriodEnd) {
          await upsertSubscription(tx, { ...subscriptionSnapshot(sub), status: "canceled", canceledAt: now })
          result.canceled++
          return { dealershipId: sub.dealershipId, summary: `${plan.name} subscription ended at period end` }
        }
        const periodStart = sub.currentPeriodEnd
        const periodEnd = addInterval(periodStart, sub.interval)
        const snapshot = { ...subscriptionSnapshot(sub), currentPeriodStart: periodStart, currentPeriodEnd: periodEnd }
        await upsertSubscription(tx, snapshot)
        const { paid } = await invoiceAndCharge(tx, { subscription: snapshot, plan, periodStart, periodEnd, declines: Boolean(declines), reason: "renewal" })
        await refreshSubscriptionStatus(tx, sub.id)
        result.renewed++
        result[paid ? "paid" : "failed"]++
        return { dealershipId: sub.dealershipId, summary: `${plan.name} renewal ${paid ? "paid" : "payment failed"}` }
      }),
    )
  }

  // Smart retries for invoices that failed earlier.
  const open = await db
    .select({ invoice: billingInvoices })
    .from(billingInvoices)
    .where(
      and(
        eq(billingInvoices.provider, "sandbox"),
        eq(billingInvoices.status, "open"),
        lt(billingInvoices.attemptCount, MAX_ATTEMPTS),
        lt(billingInvoices.issuedAt, now),
      ),
    )
  for (const { invoice } of open) {
    const outcome = await sandboxProvider.retryInvoice(invoice)
    result.retried++
    result[outcome.paid ? "paid" : "failed"]++
  }
  return result
}

// ─── Provider ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function mutateSubscription(sub: Subscription, type: string, summary: string, change: (s: SubscriptionSnapshot) => SubscriptionSnapshot) {
  await processEventOnce(db, sandboxEvent(type), () =>
    db.transaction(async (tx) => {
      const current = await subscriptionRow(tx, sub.providerSubscriptionId)
      await upsertSubscription(tx, change(subscriptionSnapshot(current)))
      return { dealershipId: sub.dealershipId, summary }
    }),
  )
}

export const sandboxProvider: BillingProvider = {
  name: "sandbox",

  async startCheckout({ plan }) {
    return `/billing/checkout?plan=${plan.id}`
  },

  async portalUrl() {
    return "/billing#payment-method"
  },

  // The sandbox switches price immediately and bills the new price from the next renewal (Stripe prorates instead).
  changePlan(sub, plan) {
    return mutateSubscription(sub, "customer.subscription.updated", `Plan changed to ${plan.name}`, (s) => ({
      ...s,
      planId: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
    }))
  },

  async cancel(sub, atPeriodEnd) {
    if (atPeriodEnd) {
      return mutateSubscription(sub, "customer.subscription.updated", "Set to cancel at period end", (s) => ({ ...s, cancelAtPeriodEnd: true }))
    }
    await processEventOnce(db, sandboxEvent("customer.subscription.deleted"), () =>
      db.transaction(async (tx) => {
        const current = await subscriptionRow(tx, sub.providerSubscriptionId)
        await upsertSubscription(tx, { ...subscriptionSnapshot(current), status: "canceled", canceledAt: new Date(), cancelAtPeriodEnd: false })
        // Like Stripe, cancelling immediately voids what is still owed on this subscription.
        await tx
          .update(billingInvoices)
          .set({ status: "void", nextPaymentAttempt: null, updatedAt: new Date() })
          .where(and(eq(billingInvoices.subscriptionId, current.id), eq(billingInvoices.status, "open")))
        return { dealershipId: sub.dealershipId, summary: "Subscription canceled immediately" }
      }),
    )
  },

  resume(sub) {
    return mutateSubscription(sub, "customer.subscription.updated", "Cancellation withdrawn", (s) => ({ ...s, cancelAtPeriodEnd: false }))
  },

  async retryInvoice(invoice) {
    if (invoice.status !== "open") throw new HttpError(409, "Only open invoices can be paid")
    let outcome = { paid: false, attempts: 0 }
    await processEventOnce(db, sandboxEvent("invoice.payment_attempted"), () =>
      db.transaction(async (tx) => {
        const account = await lockAccount(tx, invoice.dealershipId)
        const [fresh] = await tx.select().from(billingInvoices).where(eq(billingInvoices.id, invoice.id))
        if (!fresh || fresh.status !== "open") throw new HttpError(409, "Only open invoices can be paid")
        const sub = fresh.subscriptionId ? (await tx.select().from(subscriptions).where(eq(subscriptions.id, fresh.subscriptionId)))[0] : undefined
        outcome = await chargeInvoice(tx, invoiceSnapshot(fresh, sub?.providerSubscriptionId ?? null), Boolean(account?.sandboxCardDeclines))
        if (fresh.subscriptionId) await refreshSubscriptionStatus(tx, fresh.subscriptionId)
        return { dealershipId: invoice.dealershipId, summary: `Invoice ${fresh.number} ${outcome.paid ? "paid" : "payment failed"}` }
      }),
    )
    return outcome.paid ? { paid: true } : { paid: false, message: "The card on file was declined." }
  },

  async voidInvoice(invoice) {
    if (invoice.status !== "open" && invoice.status !== "draft") throw new HttpError(409, "Only open invoices can be voided")
    await processEventOnce(db, sandboxEvent("invoice.voided"), () =>
      db.transaction(async (tx) => {
        await tx
          .update(billingInvoices)
          .set({ status: "void", nextPaymentAttempt: null, updatedAt: new Date() })
          .where(eq(billingInvoices.id, invoice.id))
        if (invoice.subscriptionId) await refreshSubscriptionStatus(tx, invoice.subscriptionId)
        return { dealershipId: invoice.dealershipId, summary: `Invoice ${invoice.number} voided` }
      }),
    )
  },

  async refund(transaction) {
    if (transaction.status !== "succeeded" && transaction.status !== "partially_refunded") {
      throw new HttpError(409, "Only successful payments can be refunded")
    }
    await processEventOnce(db, sandboxEvent("charge.refunded"), async () => {
      await upsertTransaction(db, {
        provider: "sandbox",
        providerTransactionId: transaction.providerTransactionId,
        dealershipId: transaction.dealershipId,
        providerInvoiceId: null,
        status: "refunded",
        amount: transaction.amount,
        amountRefunded: transaction.amount,
        fee: transaction.fee,
        currency: transaction.currency,
        cardBrand: transaction.cardBrand,
        cardLast4: transaction.cardLast4,
        failureCode: null,
        failureMessage: null,
        receiptUrl: transaction.receiptUrl,
        occurredAt: transaction.occurredAt,
      })
      return { dealershipId: transaction.dealershipId, summary: "Payment refunded in full" }
    })
  },
}
