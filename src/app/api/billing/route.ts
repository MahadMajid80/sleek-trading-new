import { NextResponse } from "next/server"

import { getBillingSummary } from "@/features/billing/server"
import { handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET() {
  try {
    return NextResponse.json(await getBillingSummary(await currentDealershipId()))
  } catch (error) {
    return handleRouteError(error)
  }
}
