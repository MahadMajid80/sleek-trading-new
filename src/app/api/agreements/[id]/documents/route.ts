import { NextResponse } from "next/server"

import { uploadAgreementDocument } from "@/features/agreements/documents"
import { assertId, handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function POST(request: Request, { params }: RouteContext<"/api/agreements/[id]/documents">) {
  try {
    const id = assertId((await params).id)
    const form = await request.formData()
    const row = await uploadAgreementDocument(await currentDealershipId(), id, form.get("file"))
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
