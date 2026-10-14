import { NextResponse } from "next/server"

import { dealershipOptions } from "@/features/admin/server"
import { carFacets } from "@/features/cars/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

// Filter options for the admin tables.
export async function GET() {
  try {
    await requireSuperAdmin()
    const [dealerships, facets] = await Promise.all([dealershipOptions(), carFacets()])
    return NextResponse.json({ dealerships, ...facets })
  } catch (error) {
    return handleRouteError(error)
  }
}
