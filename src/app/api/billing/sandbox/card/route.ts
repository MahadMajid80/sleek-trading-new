import { NextResponse } from "next/server"
import { z } from "zod"

import { setSandboxCard } from "@/features/billing/sandbox"
import { handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

/** Sandbox stand-in for the Stripe customer portal: swap the test card on file between approving and declining. */
export async function POST(request: Request) {
  try {
    const { declines } = await parseBody(request, z.object({ declines: z.boolean() }))
    await setSandboxCard(await currentDealershipId(), declines)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
