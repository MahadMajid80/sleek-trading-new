import { NextResponse } from "next/server"

import { listInstallments } from "@/features/installments/server"
import { handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listInstallments(await currentDealershipId(), request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
