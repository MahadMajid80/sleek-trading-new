import { NextResponse } from "next/server"

import { handleRouteError } from "@/server/http"
import { searchRecords } from "@/server/search"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? ""
    return NextResponse.json(await searchRecords(await currentDealershipId(), q))
  } catch (error) {
    return handleRouteError(error)
  }
}
