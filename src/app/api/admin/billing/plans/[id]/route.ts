import { NextResponse } from "next/server"

import { deletePlan, planConstraintMessages, planSchema, savePlan } from "@/features/billing/server"
import { assertId, handleRouteError, parseBody } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/billing/plans/[id]">) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await savePlan(assertId((await params).id), await parseBody(request, planSchema)))
  } catch (error) {
    return handleRouteError(error, planConstraintMessages)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/admin/billing/plans/[id]">) {
  try {
    await requireSuperAdmin()
    await deletePlan(assertId((await params).id))
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
