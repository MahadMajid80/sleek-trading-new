import { NextResponse } from "next/server"

import { listInstallments } from "@/features/installments/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(request: Request) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listInstallments(null, request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
