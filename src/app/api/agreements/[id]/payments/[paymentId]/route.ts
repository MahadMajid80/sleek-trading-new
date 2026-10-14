import { NextResponse } from "next/server"

import { reversePayment } from "@/features/payments/server"
import { assertId, handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function DELETE(_request: Request, { params }: RouteContext<"/api/agreements/[id]/payments/[paymentId]">) {
  try {
    const { id, paymentId } = await params
    await reversePayment(await currentDealershipId(), assertId(id), assertId(paymentId))
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
