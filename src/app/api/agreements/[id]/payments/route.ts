import { NextResponse } from "next/server"

import { recordPayment } from "@/features/payments/server"
import { assertId, handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function POST(request: Request, { params }: RouteContext<"/api/agreements/[id]/payments">) {
  try {
    const id = assertId((await params).id)
    const { payment, plan } = await recordPayment(await currentDealershipId(), id, await request.formData())
    return NextResponse.json({ id: payment.id, ...plan }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
