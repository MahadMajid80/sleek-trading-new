import { NextResponse } from "next/server"

import { brandingSchema, updateBranding } from "@/features/branding/server"
import { requireSuperAdmin } from "@/server/auth"
import { assertId, handleRouteError, parseBody } from "@/server/http"

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]/branding">) {
  try {
    await requireSuperAdmin()
    await updateBranding(assertId((await params).id), await parseBody(request, brandingSchema))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
