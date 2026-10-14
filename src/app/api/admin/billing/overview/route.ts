import { NextResponse } from "next/server"

import { getRevenueOverview } from "@/features/billing/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await getRevenueOverview())
  } catch (error) {
    return handleRouteError(error)
  }
}
