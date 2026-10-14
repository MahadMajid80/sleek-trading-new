import { NextResponse } from "next/server"

import { listPayments } from "@/features/payments/server"
import { handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listPayments(await currentDealershipId(), request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
