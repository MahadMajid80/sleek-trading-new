import { NextResponse } from "next/server"

import { agreementSchema } from "@/features/agreements/schema"
import { deleteAgreement, getAgreement, updateAgreement } from "@/features/agreements/server"
import { assertId, handleRouteError, HttpError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(_request: Request, { params }: RouteContext<"/api/agreements/[id]">) {
  try {
    const agreement = await getAgreement(await currentDealershipId(), assertId((await params).id))
    if (!agreement) throw new HttpError(404, "Agreement not found")
    return NextResponse.json(agreement)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/agreements/[id]">) {
  try {
    const id = assertId((await params).id)
    const row = await updateAgreement(await currentDealershipId(), id, await parseBody(request, agreementSchema))
    if (!row) throw new HttpError(404, "Agreement not found")
    return NextResponse.json(row)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/agreements/[id]">) {
  try {
    const row = await deleteAgreement(await currentDealershipId(), assertId((await params).id))
    if (!row) throw new HttpError(404, "Agreement not found")
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
