import { NextResponse } from "next/server"

import { listCars } from "@/features/cars/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(request: Request) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listCars(null, request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
