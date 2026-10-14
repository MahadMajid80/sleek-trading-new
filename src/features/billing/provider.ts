import "server-only"

import type { BillingInvoice, BillingPlan, BillingTransaction, Dealership, Subscription } from "@/db/schema"

import type { BillingMode } from "./meta"
import type { Provider } from "./sync"

/**
 * Everything the app asks of a payment provider. Records remember which provider created them, so a dealership that
 * started in the sandbox keeps working after Stripe keys are added; new checkouts use the configured provider.
 */
export interface BillingProvider {
  readonly name: Provider
  /** URL to send the dealership to (Stripe Checkout, or the sandbox checkout page). */
  startCheckout(input: { dealership: Dealership; plan: BillingPlan; origin: string }): Promise<string>
  /** URL where the dealership manages its card (Stripe customer portal, or the in-app billing page). */
  portalUrl(input: { dealership: Dealership; origin: string }): Promise<string>
  changePlan(subscription: Subscription, plan: BillingPlan): Promise<void>
  cancel(subscription: Subscription, atPeriodEnd: boolean): Promise<void>
  resume(subscription: Subscription): Promise<void>
  /** Attempts payment of an open invoice with the card on file. */
  retryInvoice(invoice: BillingInvoice): Promise<{ paid: boolean; message?: string }>
  voidInvoice(invoice: BillingInvoice): Promise<void>
  refund(transaction: BillingTransaction): Promise<void>
}

export function billingMode(): BillingMode {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return "sandbox"
  return key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "stripe_live" : "stripe_test"
}

export const configuredProvider = (): Provider => (billingMode() === "sandbox" ? "sandbox" : "stripe")

export async function providerFor(name: Provider): Promise<BillingProvider> {
  if (name === "stripe") {
    const { stripeProvider } = await import("./stripe")
    return stripeProvider()
  }
  const { sandboxProvider } = await import("./sandbox")
  return sandboxProvider
}
