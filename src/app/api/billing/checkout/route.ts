import { NextResponse } from "next/server"
import { z } from "zod"

import { appOrigin, startCheckout } from "@/features/billing/server"
import { handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function POST(request: Request) {
  try {
    const { planId } = await parseBody(request, z.object({ planId: z.uuid() }))
    return NextResponse.json({ url: await startCheckout(await currentDealershipId(), planId, appOrigin(request)) })
  } catch (error) {
    return handleRouteError(error)
  }
}
