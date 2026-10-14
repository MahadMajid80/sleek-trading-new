import { NextResponse } from "next/server"

import { subscriptionActionSchema, updateSubscription } from "@/features/billing/server"
import { assertId, handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function PATCH(request: Request, { params }: RouteContext<"/api/billing/subscriptions/[id]">) {
  try {
    const input = await parseBody(request, subscriptionActionSchema)
    return NextResponse.json(await updateSubscription(await currentDealershipId(), assertId((await params).id), input))
  } catch (error) {
    return handleRouteError(error)
  }
}
