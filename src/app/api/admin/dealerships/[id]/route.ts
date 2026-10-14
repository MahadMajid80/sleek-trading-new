import { NextResponse } from "next/server"

import { deleteDealership, dealershipSchema, getDealershipDetail, updateDealership } from "@/features/admin/dealership-server"
import { requireSuperAdmin } from "@/server/auth"
import { assertId, handleRouteError, HttpError, parseBody } from "@/server/http"

export async function GET(_request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]">) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await getDealershipDetail(assertId((await params).id)))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]">) {
  try {
    await requireSuperAdmin()
    const row = await updateDealership(assertId((await params).id), await parseBody(request, dealershipSchema))
    if (!row) throw new HttpError(404, "Dealership not found")
    return NextResponse.json(row)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]">) {
  try {
    await requireSuperAdmin()
    const row = await deleteDealership(assertId((await params).id))
    if (!row) throw new HttpError(404, "Dealership not found")
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
