import { NextResponse } from "next/server"

import { parseLogoUpload, removeLogo, saveLogo } from "@/features/branding/server"
import { requireDealerAdmin } from "@/server/auth"
import { handleRouteError } from "@/server/http"

export async function POST(request: Request) {
  try {
    const { dealership } = await requireDealerAdmin()
    const { file, wide } = await parseLogoUpload(request)
    await saveLogo(dealership.id, file, wide)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE() {
  try {
    const { dealership } = await requireDealerAdmin()
    await removeLogo(dealership.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
