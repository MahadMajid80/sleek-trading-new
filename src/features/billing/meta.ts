// Client-safe billing helpers: money formatting and status labels shared by the staff and admin screens.

import type { BillingInvoiceStatus, BillingTransactionStatus, SubscriptionStatus } from "@/db/schema"

export type BillingMode = "stripe_test" | "stripe_live" | "sandbox"

const formatters = new Map<string, Intl.NumberFormat>()

/** Amounts are stored in minor units (cents) exactly as the payment provider reports them. */
export function formatMoney(minor: number, currency = "kes", options: { compact?: boolean } = {}) {
  const key = `${currency}:${options.compact ? "c" : "f"}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: options.compact ? "compact" : "standard",
      maximumFractionDigits: options.compact ? 1 : minor % 100 === 0 ? 0 : 2,
      minimumFractionDigits: 0,
    })
    formatters.set(key, formatter)
  }
  return formatter.format(minor / 100)
}

export const LIVE_SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "unpaid", "incomplete", "paused"] as const

export const subscriptionStatusMeta: Record<SubscriptionStatus, { label: string; className: string }> = {
  trialing: { label: "Trial", className: "border-sky-400/40 bg-sky-400/12 text-sky-600 dark:text-sky-300" },
  active: { label: "Active", className: "border-success/30 bg-success/12 text-success" },
  past_due: { label: "Past due", className: "border-warning/40 bg-warning/14 text-warning" },
  unpaid: { label: "Unpaid", className: "border-destructive/30 bg-destructive/12 text-destructive" },
  canceled: { label: "Canceled", className: "text-muted-foreground" },
  incomplete: { label: "Incomplete", className: "border-warning/40 bg-warning/14 text-warning" },
  incomplete_expired: { label: "Expired", className: "text-muted-foreground" },
  paused: { label: "Paused", className: "text-muted-foreground" },
}

export const invoiceStatusMeta: Record<BillingInvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "text-muted-foreground" },
  open: { label: "Open", className: "border-warning/40 bg-warning/14 text-warning" },
  paid: { label: "Paid", className: "border-success/30 bg-success/12 text-success" },
  void: { label: "Void", className: "text-muted-foreground line-through" },
  uncollectible: { label: "Uncollectible", className: "border-destructive/30 bg-destructive/12 text-destructive" },
}

export const transactionStatusMeta: Record<BillingTransactionStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-muted-foreground" },
  succeeded: { label: "Succeeded", className: "border-success/30 bg-success/12 text-success" },
  failed: { label: "Failed", className: "border-destructive/30 bg-destructive/12 text-destructive" },
  refunded: { label: "Refunded", className: "border-sky-400/40 bg-sky-400/12 text-sky-600 dark:text-sky-300" },
  partially_refunded: { label: "Part refunded", className: "border-sky-400/40 bg-sky-400/12 text-sky-600 dark:text-sky-300" },
}

export const billingModeMeta: Record<BillingMode, { label: string; description: string }> = {
  sandbox: {
    label: "Sandbox",
    description: "No Stripe key configured. Checkout, charges and webhooks are simulated locally.",
  },
  stripe_test: { label: "Stripe · test mode", description: "Connected to Stripe with a test key. No real money moves." },
  stripe_live: { label: "Stripe · live", description: "Connected to Stripe with a live key. Charges are real." },
}

export const cardLabel = (brand: string | null, last4: string | null) =>
  brand && last4 ? `${brand.charAt(0).toUpperCase()}${brand.slice(1)} •••• ${last4}` : null

/** Monthly value of a subscription price, for MRR. */
export const monthlyAmount = (amount: number, interval: "month" | "year") => (interval === "year" ? Math.round(amount / 12) : amount)
