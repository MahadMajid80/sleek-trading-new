import { NextResponse } from "next/server"

import { payInvoice } from "@/features/billing/server"
import { assertId, handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function POST(_request: Request, { params }: RouteContext<"/api/billing/invoices/[id]/pay">) {
  try {
    return NextResponse.json(await payInvoice(await currentDealershipId(), assertId((await params).id)))
  } catch (error) {
    return handleRouteError(error)
  }
}
