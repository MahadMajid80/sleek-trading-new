import { NextResponse } from "next/server"
import { z } from "zod"

import { runSandboxRenewals } from "@/features/billing/sandbox"
import { handleRouteError, parseBody } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

// Sandbox-only tool: simulates a billing period passing (renewal invoices, card charges, retries). Stripe does this
// itself for Stripe subscriptions; they are untouched.
export async function POST(request: Request) {
  try {
    await requireSuperAdmin()
    const { force } = await parseBody(request, z.object({ force: z.boolean().default(true) }))
    return NextResponse.json(await runSandboxRenewals({ force }))
  } catch (error) {
    return handleRouteError(error)
  }
}
