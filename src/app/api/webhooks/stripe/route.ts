import { NextResponse } from "next/server"

import { handleStripeWebhook } from "@/features/billing/stripe"
import { handleRouteError } from "@/server/http"

// Stripe → us. Configure the endpoint in the Stripe dashboard (or `stripe listen --forward-to localhost:3100/api/webhooks/stripe`)
// and put its signing secret in STRIPE_WEBHOOK_SECRET. The raw body is required for signature verification.
export async function POST(request: Request) {
  try {
    const result = await handleStripeWebhook(await request.text(), request.headers.get("stripe-signature"))
    return NextResponse.json({ received: true, duplicate: result.duplicate })
  } catch (error) {
    // A non-2xx makes Stripe retry, which is what we want for transient failures.
    return handleRouteError(error)
  }
}
