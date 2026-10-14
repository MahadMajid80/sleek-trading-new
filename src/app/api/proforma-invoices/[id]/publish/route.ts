import { NextResponse } from "next/server"

import { publishProforma } from "@/features/invoices/server"
import { assertId, handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function POST(_request: Request, { params }: RouteContext<"/api/proforma-invoices/[id]/publish">) {
  try {
    const finalInvoice = await publishProforma(await currentDealershipId(), assertId((await params).id))
    return NextResponse.json(finalInvoice, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
