import { NextResponse } from "next/server"

import { agreementSchema } from "@/features/agreements/schema"
import { createAgreement, listAgreements } from "@/features/agreements/server"
import { handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listAgreements(await currentDealershipId(), request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, agreementSchema)
    return NextResponse.json(await createAgreement(await currentDealershipId(), input), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
