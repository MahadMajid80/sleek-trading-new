import { NextResponse } from "next/server"
import { z } from "zod"

import { configuredProvider } from "@/features/billing/provider"
import { completeSandboxCheckout } from "@/features/billing/sandbox"
import { handleRouteError, HttpError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

// Stands in for Stripe Checkout while no Stripe key is configured.
export async function POST(request: Request) {
  try {
    if (configuredProvider() !== "sandbox") throw new HttpError(404, "Sandbox checkout is disabled while Stripe is configured")
    const { planId, outcome } = await parseBody(request, z.object({ planId: z.uuid(), outcome: z.enum(["approves", "declines"]) }))
    await completeSandboxCheckout(await currentDealershipId(), planId, outcome)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
