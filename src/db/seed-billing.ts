// Sandbox billing history for the seeded dealerships, written through the same snapshot upserts real webhooks use.

import { addDays, addMonths, subMonths } from "date-fns"
import { eq } from "drizzle-orm"

import {
  ensureBillingAccount,
  setAccountCard,
  upsertInvoice,
  upsertSubscription,
  upsertTransaction,
  type Executor,
  type InvoiceSnapshot,
  type SubscriptionSnapshot,
} from "../features/billing/sync"

import { billingAccounts, billingEvents, billingPlans, subscriptions, type BillingPlan } from "./schema"

// Growth is the only public plan for now. A custom plan is seeded too, to show how per-dealership pricing looks.
const PLANS = [
  {
    code: "growth",
    name: "Growth",
    description: "Hire purchase at scale with collections tooling.",
    amount: 12_900_00,
    features: ["Unlimited customers & vehicles", "Hire purchase ledger & statements", "Installment reminders", "Priority support"],
  },
] as const

type Story = {
  plan: (typeof PLANS)[number]["code"]
  startMonthsAgo: number
  upgrade?: { plan: (typeof PLANS)[number]["code"]; monthsAgo: number }
  canceledMonthsAgo?: number
  /** Failed attempts on the current (latest) invoice, leaving it open and the subscription past due. */
  failingNow?: number
  /** Months ago whose invoice failed once before succeeding on retry. */
  retriedMonthsAgo?: number
  refundedMonthsAgo?: number
}

const STORIES: Record<string, Story> = {
  SLK: { plan: "growth", startMonthsAgo: 11, refundedMonthsAgo: 4 },
  NRB: { plan: "growth", startMonthsAgo: 9, retriedMonthsAgo: 5 },
  MSA: { plan: "growth", startMonthsAgo: 6, failingNow: 2 },
  ELD: { plan: "growth", startMonthsAgo: 5, canceledMonthsAgo: 2 },
}

const APPROVES = { brand: "visa", last4: "4242", expMonth: 12, expYear: new Date().getFullYear() + 3 }
const DECLINES = { brand: "visa", last4: "0002", expMonth: 12, expYear: new Date().getFullYear() + 3 }
const fee = (amount: number) => Math.round(amount * 0.029) + 3000
let seq = 0
const rid = (prefix: string) => `${prefix}_seed${String(++seq).padStart(6, "0")}`

export async function seedBilling(db: Executor, dealershipsByCode: Map<string, string>) {
  const plans = await db
    .insert(billingPlans)
    .values(PLANS.map((plan, index) => ({ ...plan, features: [...plan.features], currency: "kes", interval: "month" as const, sortOrder: index + 1 })))
    .returning()
  const nairobi = dealershipsByCode.get("NRB")
  if (nairobi) {
    await db.insert(billingPlans).values({
      code: "custom-nrb-nairobi-premium",
      dealershipId: nairobi,
      name: "Nairobi Premium",
      description: "Agreed pricing for Sleek Motors Nairobi.",
      amount: 9_900_00,
      currency: "kes",
      interval: "month",
      features: ["Everything in Growth", "Negotiated rate", "Dedicated onboarding"],
      sortOrder: 2,
    })
  }
  const planByCode = new Map(plans.map((plan) => [plan.code, plan]))
  const now = new Date()
  let invoices = 0

  for (const [code, story] of Object.entries(STORIES)) {
    const dealershipId = dealershipsByCode.get(code)
    if (!dealershipId) continue
    await ensureBillingAccount(db, dealershipId, "sandbox", { providerCustomerId: `sbx_cus_${dealershipId.slice(0, 8)}` })
    await setAccountCard(db, dealershipId, story.failingNow ? DECLINES : APPROVES)
    if (story.failingNow) await db.update(billingAccounts).set({ sandboxCardDeclines: true }).where(eq(billingAccounts.dealershipId, dealershipId))

    const start = subMonths(now, story.startMonthsAgo)
    const canceledAt = story.canceledMonthsAgo !== undefined ? subMonths(now, story.canceledMonthsAgo) : null
    const planAt = (date: Date): BillingPlan =>
      planByCode.get(story.upgrade && date >= subMonths(now, story.upgrade.monthsAgo) ? story.upgrade.plan : story.plan)!

    let periodStart = start
    let number = 0
    const providerSubscriptionId = rid("sbx_sub")
    let subscription: SubscriptionSnapshot | undefined
    while (periodStart <= now && (!canceledAt || periodStart < canceledAt)) {
      const periodEnd = addMonths(periodStart, 1)
      const plan = planAt(periodStart)
      const monthsAgo = Math.round((now.getTime() - periodStart.getTime()) / (30.44 * 86_400_000))
      const isCurrent = periodEnd > now
      subscription = {
        provider: "sandbox",
        providerSubscriptionId,
        dealershipId,
        planId: plan.id,
        status: isCurrent && story.failingNow ? "past_due" : "active",
        amount: plan.amount,
        currency: plan.currency,
        interval: "month",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
      }
      await upsertSubscription(db, subscription)

      const failing = isCurrent && story.failingNow ? story.failingNow : 0
      const retried = story.retriedMonthsAgo === monthsAgo
      const invoice: InvoiceSnapshot = {
        provider: "sandbox",
        providerInvoiceId: rid("sbx_in"),
        dealershipId,
        providerSubscriptionId,
        number: `${code}-${String(++number).padStart(4, "0")}`,
        status: failing ? "open" : "paid",
        description: `${plan.name} plan · ${number === 1 ? "first payment" : "renewal"}`,
        amountDue: plan.amount,
        amountPaid: failing ? 0 : plan.amount,
        amountRemaining: failing ? plan.amount : 0,
        currency: plan.currency,
        periodStart,
        periodEnd,
        dueDate: periodStart,
        paidAt: failing ? null : addDays(periodStart, retried ? 3 : 0),
        attemptCount: failing || (retried ? 2 : 1),
        nextPaymentAttempt: failing ? addDays(now, 2) : null,
        hostedInvoiceUrl: null,
        invoicePdfUrl: null,
        issuedAt: periodStart,
      }
      await upsertInvoice(db, invoice)
      invoices++

      const attempts = failing ? failing : retried ? 2 : 1
      for (let attempt = 0; attempt < attempts; attempt++) {
        const failed = failing > 0 || (retried && attempt === 0)
        const refunded = !failed && story.refundedMonthsAgo === monthsAgo
        await upsertTransaction(db, {
          provider: "sandbox",
          providerTransactionId: rid("sbx_ch"),
          dealershipId,
          providerInvoiceId: invoice.providerInvoiceId,
          status: failed ? "failed" : refunded ? "refunded" : "succeeded",
          amount: plan.amount,
          amountRefunded: refunded ? plan.amount : 0,
          fee: failed ? null : fee(plan.amount),
          currency: plan.currency,
          cardBrand: "visa",
          cardLast4: failed ? DECLINES.last4 : APPROVES.last4,
          failureCode: failed ? (attempt === 0 ? "insufficient_funds" : "card_declined") : null,
          failureMessage: failed ? (attempt === 0 ? "Your card has insufficient funds." : "Your card was declined.") : null,
          receiptUrl: null,
          // Retries three days apart, but never in the future.
          occurredAt: new Date(Math.min(addDays(periodStart, attempt * 3).getTime(), now.getTime() - (attempts - attempt) * 3_600_000)),
        })
      }
      periodStart = periodEnd
    }

    if (subscription && canceledAt) {
      await upsertSubscription(db, { ...subscription, status: "canceled", canceledAt })
    }
    // Upserts stamp created_at with "now"; backdate it to when this subscription actually started.
    await db.update(subscriptions).set({ createdAt: start }).where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
    await db.insert(billingEvents).values({
      id: rid("sbx_evt"),
      provider: "sandbox",
      type: canceledAt ? "customer.subscription.deleted" : story.failingNow ? "invoice.payment_failed" : "invoice.paid",
      dealershipId,
      summary: canceledAt ? "Subscription canceled" : story.failingNow ? "Renewal payment failed" : "Renewal paid",
      receivedAt: canceledAt ?? subMonths(now, 0),
      processedAt: canceledAt ?? now,
    })
  }
  return { plans: plans.length, invoices }
}
