import { NextResponse } from "next/server"

import { parseLogoUpload, removeLogo, saveLogo } from "@/features/branding/server"
import { requireSuperAdmin } from "@/server/auth"
import { assertId, handleRouteError } from "@/server/http"

export async function POST(request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]/logo">) {
  try {
    await requireSuperAdmin()
    const { file, wide } = await parseLogoUpload(request)
    await saveLogo(assertId((await params).id), file, wide)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]/logo">) {
  try {
    await requireSuperAdmin()
    await removeLogo(assertId((await params).id))
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
