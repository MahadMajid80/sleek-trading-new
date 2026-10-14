import { NextResponse } from "next/server"

import { appOrigin, portalUrl } from "@/features/billing/server"
import { handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function POST(request: Request) {
  try {
    return NextResponse.json({ url: await portalUrl(await currentDealershipId(), appOrigin(request)) })
  } catch (error) {
    return handleRouteError(error)
  }
}
