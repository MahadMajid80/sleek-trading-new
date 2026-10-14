import { NextResponse } from "next/server"

import { brandingSchema, updateBranding } from "@/features/branding/server"
import { requireDealerAdmin } from "@/server/auth"
import { handleRouteError, parseBody } from "@/server/http"

export async function PATCH(request: Request) {
  try {
    const { dealership } = await requireDealerAdmin()
    await updateBranding(dealership.id, await parseBody(request, brandingSchema))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
