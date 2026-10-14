import "server-only"

import { and, eq } from "drizzle-orm"
import Stripe from "stripe"

import { db } from "@/db"
import {
  billingAccounts,
  billingPlans,
  billingTransactions,
  subscriptions,
  type BillingPlan,
  type Dealership,
  type SubscriptionStatus,
} from "@/db/schema"
import { HttpError } from "@/server/http"

import type { BillingProvider } from "./provider"
import {
  dealershipForCustomer,
  ensureBillingAccount,
  processEventOnce,
  setAccountCard,
  transactionStatus,
  upsertInvoice,
  upsertSubscription,
  upsertTransaction,
  type CardSnapshot,
  type TransactionSnapshot,
} from "./sync"

// Stripe Billing integration. Stripe owns subscriptions, invoices, retries and card storage; we create customers and
// Checkout/Portal sessions, and mirror Stripe's objects into our tables from webhooks (always re-fetching the latest
// object, so event order and retries don't matter). API version is the one pinned by the installed SDK.

const globalForStripe = globalThis as unknown as { __stripe?: Stripe }

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new HttpError(503, "Stripe is not configured (STRIPE_SECRET_KEY is missing)")
  globalForStripe.__stripe ??= new Stripe(key, { appInfo: { name: "AutoVault" } })
  return globalForStripe.__stripe
}

const toDate = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null)
const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null))

const STATUS: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "unpaid",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  paused: "paused",
}

// Stripe's enums are open-ended (new values may appear); map anything unknown to the safest local value.
const chargeStatus = (status: string) => (status === "succeeded" || status === "failed" ? status : "pending")
const invoiceStatus = (status: string | null) =>
  status === "open" || status === "paid" || status === "void" || status === "uncollectible" ? status : "draft"

// ─── Customers & prices ──────────────────────────────────────────────────────────────────────────────────────────────

async function ensureCustomer(dealership: Dealership) {
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.dealershipId, dealership.id))
  if (account?.provider === "stripe" && account.providerCustomerId) return account.providerCustomerId
  const customer = await stripe().customers.create(
    {
      name: dealership.name,
      email: account?.email ?? dealership.email ?? undefined,
      metadata: { dealershipId: dealership.id, dealershipCode: dealership.code },
    },
    { idempotencyKey: `customer-${dealership.id}` },
  )
  await ensureBillingAccount(db, dealership.id, "stripe", { providerCustomerId: customer.id })
  return customer.id
}

/** Creates the Stripe Product/Price for a plan on first use; a new price replaces the old one after a price change. */
export async function ensureStripePrice(plan: BillingPlan) {
  if (plan.stripePriceId) return plan.stripePriceId
  const productId =
    plan.stripeProductId ??
    (await stripe().products.create({ name: `AutoVault · ${plan.name}`, metadata: { planId: plan.id, planCode: plan.code } })).id
  const price = await stripe().prices.create({
    product: productId,
    currency: plan.currency,
    unit_amount: plan.amount,
    recurring: { interval: plan.interval },
    metadata: { planId: plan.id },
  })
  await db.update(billingPlans).set({ stripeProductId: productId, stripePriceId: price.id }).where(eq(billingPlans.id, plan.id))
  return price.id
}

// ─── Sync: Stripe object → our tables ────────────────────────────────────────────────────────────────────────────────

async function syncSubscription(subscriptionId: string) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId)
  const customerId = idOf(sub.customer)!
  const dealershipId = sub.metadata.dealershipId || (await dealershipForCustomer(db, "stripe", customerId))
  if (!dealershipId) throw new Error(`No dealership for Stripe customer ${customerId}`)
  const item = sub.items.data[0]
  if (!item) throw new Error(`Subscription ${sub.id} has no items`)
  let planId: string | undefined = sub.metadata.planId || item.price.metadata.planId
  if (!planId) {
    const [plan] = await db.select({ id: billingPlans.id }).from(billingPlans).where(eq(billingPlans.stripePriceId, item.price.id))
    planId = plan?.id
  }
  if (!planId) throw new Error(`Subscription ${sub.id} does not map to a plan`)

  const row = await upsertSubscription(db, {
    provider: "stripe",
    providerSubscriptionId: sub.id,
    dealershipId,
    planId,
    status: STATUS[sub.status] ?? "incomplete",
    amount: (item.price.unit_amount ?? 0) * (item.quantity ?? 1),
    currency: item.price.currency,
    interval: item.price.recurring?.interval === "year" ? "year" : "month",
    currentPeriodStart: toDate(item.current_period_start)!,
    currentPeriodEnd: toDate(item.current_period_end)!,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
    trialEnd: toDate(sub.trial_end),
  })
  return { dealershipId, summary: `Subscription ${row.status.replace("_", " ")}` }
}

const cardOf = (charge: Stripe.Charge): CardSnapshot | null => {
  const card = charge.payment_method_details?.card
  return card?.last4 ? { brand: card.brand ?? "card", last4: card.last4, expMonth: card.exp_month ?? null, expYear: card.exp_year ?? null } : null
}

function chargeSnapshot(charge: Stripe.Charge, dealershipId: string, providerInvoiceId: string | null): TransactionSnapshot {
  const bt = typeof charge.balance_transaction === "object" ? charge.balance_transaction : null
  const card = cardOf(charge)
  return {
    provider: "stripe",
    providerTransactionId: charge.id,
    dealershipId,
    providerInvoiceId,
    status: transactionStatus(charge.amount, charge.amount_refunded, chargeStatus(charge.status)),
    amount: charge.amount,
    amountRefunded: charge.amount_refunded,
    // Fees are reported in the settlement currency; only keep them when that matches the charge.
    fee: bt && bt.currency === charge.currency ? bt.fee : null,
    currency: charge.currency,
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    failureCode: charge.failure_code,
    failureMessage: charge.failure_message,
    receiptUrl: charge.receipt_url,
    occurredAt: toDate(charge.created)!,
  }
}

async function syncInvoice(invoiceId: string) {
  const invoice = await stripe().invoices.retrieve(invoiceId, { expand: ["payments"] })
  const customerId = idOf(invoice.customer)
  const dealershipId =
    invoice.parent?.subscription_details?.metadata?.dealershipId || (customerId ? await dealershipForCustomer(db, "stripe", customerId) : null)
  if (!dealershipId) throw new Error(`No dealership for invoice ${invoice.id}`)

  const providerSubscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
  if (providerSubscriptionId) {
    const [known] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.provider, "stripe"), eq(subscriptions.providerSubscriptionId, providerSubscriptionId)))
    if (!known) await syncSubscription(providerSubscriptionId)
  }

  await upsertInvoice(db, {
    provider: "stripe",
    providerInvoiceId: invoice.id!,
    dealershipId,
    providerSubscriptionId,
    number: invoice.number,
    status: invoiceStatus(invoice.status),
    description: invoice.description ?? invoice.lines.data[0]?.description ?? null,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    currency: invoice.currency,
    periodStart: toDate(invoice.period_start),
    periodEnd: toDate(invoice.period_end),
    dueDate: toDate(invoice.due_date),
    paidAt: toDate(invoice.status_transitions.paid_at),
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: toDate(invoice.next_payment_attempt),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    issuedAt: toDate(invoice.status_transitions.finalized_at) ?? toDate(invoice.created)!,
  })

  // Every charge attempt (failed retries included) behind this invoice's payments.
  let latestCard: CardSnapshot | null = null
  for (const payment of invoice.payments?.data ?? []) {
    const paymentIntentId = idOf(payment.payment.payment_intent)
    if (!paymentIntentId) continue
    const charges = await stripe().charges.list({ payment_intent: paymentIntentId, limit: 20, expand: ["data.balance_transaction"] })
    for (const charge of charges.data) {
      await upsertTransaction(db, chargeSnapshot(charge, dealershipId, invoice.id!))
      if (charge.status === "succeeded") latestCard ??= cardOf(charge)
    }
  }
  if (latestCard) await setAccountCard(db, dealershipId, latestCard)
  return { dealershipId, summary: `Invoice ${invoice.number ?? invoice.id} ${invoice.status}` }
}

async function syncCharge(charge: Stripe.Charge) {
  const [existing] = await db
    .select({ dealershipId: billingTransactions.dealershipId })
    .from(billingTransactions)
    .where(and(eq(billingTransactions.provider, "stripe"), eq(billingTransactions.providerTransactionId, charge.id)))
  // Charges we haven't seen belong to invoices and arrive through the invoice sync.
  if (!existing) return
  await upsertTransaction(db, chargeSnapshot(charge, existing.dealershipId, null))
  return { dealershipId: existing.dealershipId, summary: `Charge ${charge.status}${charge.amount_refunded ? " (refunded)" : ""}` }
}

async function syncCustomerCard(customerId: string) {
  const dealershipId = await dealershipForCustomer(db, "stripe", customerId)
  if (!dealershipId) return
  const customer = await stripe().customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] })
  if (customer.deleted) return
  const pm = customer.invoice_settings.default_payment_method
  const card = typeof pm === "object" && pm?.card ? pm.card : null
  if (card) {
    await setAccountCard(db, dealershipId, { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year })
  }
  return { dealershipId, summary: card ? `Card on file updated (${card.brand} ${card.last4})` : "Customer updated" }
}

/** Verifies the signature and applies one webhook event (idempotently, via the billing_events log). */
export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new HttpError(503, "STRIPE_WEBHOOK_SECRET is not configured")
  if (!signature) throw new HttpError(400, "Missing Stripe-Signature header")
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch {
    throw new HttpError(400, "Invalid webhook signature")
  }

  return processEventOnce(db, { id: event.id, provider: "stripe", type: event.type, payload: event.data.object }, async () => {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        const subscriptionId = idOf(session.subscription)
        return subscriptionId ? syncSubscription(subscriptionId) : undefined
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        return syncSubscription(event.data.object.id)
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.updated":
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_succeeded":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        return syncInvoice(event.data.object.id!)
      case "invoice_payment.paid":
        return syncInvoice(idOf(event.data.object.invoice)!)
      case "charge.refunded":
      case "charge.succeeded":
      case "charge.failed":
      case "charge.updated":
        return syncCharge(event.data.object)
      case "customer.updated":
        return syncCustomerCard(event.data.object.id)
      default:
        return { summary: "Ignored" }
    }
  })
}

// ─── Provider ────────────────────────────────────────────────────────────────────────────────────────────────────────

function asHttpError(error: unknown): never {
  if (error instanceof Stripe.errors.StripeError) throw new HttpError(error.statusCode && error.statusCode < 500 ? 422 : 502, error.message)
  throw error
}

export function stripeProvider(): BillingProvider {
  return {
    name: "stripe",

    async startCheckout({ dealership, plan, origin }) {
      try {
        const [customer, price] = await Promise.all([ensureCustomer(dealership), ensureStripePrice(plan)])
        const metadata = { dealershipId: dealership.id, planId: plan.id }
        const session = await stripe().checkout.sessions.create({
          mode: "subscription",
          customer,
          client_reference_id: dealership.id,
          line_items: [{ price, quantity: 1 }],
          subscription_data: { metadata },
          metadata,
          success_url: `${origin}/billing?checkout=success`,
          cancel_url: `${origin}/billing?checkout=canceled`,
        })
        if (!session.url) throw new HttpError(502, "Stripe did not return a checkout URL")
        return session.url
      } catch (error) {
        asHttpError(error)
      }
    },

    async portalUrl({ dealership, origin }) {
      try {
        const customer = await ensureCustomer(dealership)
        const session = await stripe().billingPortal.sessions.create({ customer, return_url: `${origin}/billing` })
        return session.url
      } catch (error) {
        asHttpError(error)
      }
    },

    async changePlan(sub, plan) {
      try {
        const current = await stripe().subscriptions.retrieve(sub.providerSubscriptionId)
        const item = current.items.data[0]!
        await stripe().subscriptions.update(sub.providerSubscriptionId, {
          items: [{ id: item.id, price: await ensureStripePrice(plan) }],
          proration_behavior: "create_prorations",
          metadata: { ...current.metadata, planId: plan.id },
        })
        await syncSubscription(sub.providerSubscriptionId)
      } catch (error) {
        asHttpError(error)
      }
    },

    async cancel(sub, atPeriodEnd) {
      try {
        if (atPeriodEnd) await stripe().subscriptions.update(sub.providerSubscriptionId, { cancel_at_period_end: true })
        else await stripe().subscriptions.cancel(sub.providerSubscriptionId)
        await syncSubscription(sub.providerSubscriptionId)
      } catch (error) {
        asHttpError(error)
      }
    },

    async resume(sub) {
      try {
        await stripe().subscriptions.update(sub.providerSubscriptionId, { cancel_at_period_end: false })
        await syncSubscription(sub.providerSubscriptionId)
      } catch (error) {
        asHttpError(error)
      }
    },

    async retryInvoice(invoice) {
      try {
        await stripe().invoices.pay(invoice.providerInvoiceId)
        await syncInvoice(invoice.providerInvoiceId)
        return { paid: true }
      } catch (error) {
        // A declined card is an expected outcome: record the failed attempt and report it.
        if (error instanceof Stripe.errors.StripeCardError) {
          await syncInvoice(invoice.providerInvoiceId)
          return { paid: false, message: error.message }
        }
        asHttpError(error)
      }
    },

    async voidInvoice(invoice) {
      try {
        await stripe().invoices.voidInvoice(invoice.providerInvoiceId)
        await syncInvoice(invoice.providerInvoiceId)
      } catch (error) {
        asHttpError(error)
      }
    },

    async refund(transaction) {
      try {
        await stripe().refunds.create({ charge: transaction.providerTransactionId }, { idempotencyKey: `refund-${transaction.id}` })
        const charge = await stripe().charges.retrieve(transaction.providerTransactionId, { expand: ["balance_transaction"] })
        await upsertTransaction(db, chargeSnapshot(charge, transaction.dealershipId, null))
      } catch (error) {
        asHttpError(error)
      }
    },
  }
}
