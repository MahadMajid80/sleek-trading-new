import { NextResponse } from "next/server"

import { listBillingEvents } from "@/features/billing/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(request: Request) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listBillingEvents(request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
