import { NextResponse } from "next/server"

import { listAgreements } from "@/features/agreements/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(request: Request) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listAgreements(null, request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
