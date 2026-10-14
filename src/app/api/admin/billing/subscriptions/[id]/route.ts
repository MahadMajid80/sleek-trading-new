import { NextResponse } from "next/server"

import { subscriptionActionSchema, updateSubscription } from "@/features/billing/server"
import { assertId, handleRouteError, parseBody } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/billing/subscriptions/[id]">) {
  try {
    await requireSuperAdmin()
    const input = await parseBody(request, subscriptionActionSchema)
    return NextResponse.json(await updateSubscription(null, assertId((await params).id), input))
  } catch (error) {
    return handleRouteError(error)
  }
}
