import { NextResponse } from "next/server"

import { getAgreement } from "@/features/agreements/server"
import { assertId, handleRouteError, HttpError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(_request: Request, { params }: RouteContext<"/api/admin/agreements/[id]">) {
  try {
    await requireSuperAdmin()
    const agreement = await getAgreement(null, assertId((await params).id))
    if (!agreement) throw new HttpError(404, "Agreement not found")
    return NextResponse.json(agreement)
  } catch (error) {
    return handleRouteError(error)
  }
}
