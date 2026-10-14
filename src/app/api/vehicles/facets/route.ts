import { NextResponse } from "next/server"

import { carFacets } from "@/features/cars/server"
import { handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

/** Makes and body types in this dealership's yard, with counts, for the Cars table filters. */
export async function GET() {
  try {
    return NextResponse.json(await carFacets(await currentDealershipId()))
  } catch (error) {
    return handleRouteError(error)
  }
}
