import { NextResponse } from "next/server"

import { getPlatformOverview } from "@/features/admin/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await getPlatformOverview())
  } catch (error) {
    return handleRouteError(error)
  }
}
