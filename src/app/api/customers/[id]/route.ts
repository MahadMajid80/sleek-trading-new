import { NextResponse } from "next/server"

import { customerSchema } from "@/features/customers/schema"
import { customerConstraintMessages, deleteCustomer, updateCustomer } from "@/features/customers/server"
import { assertId, handleRouteError, HttpError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function PATCH(request: Request, { params }: RouteContext<"/api/customers/[id]">) {
  try {
    const id = assertId((await params).id)
    const input = await parseBody(request, customerSchema)
    const row = await updateCustomer(await currentDealershipId(), id, input)
    if (!row) throw new HttpError(404, "Customer not found")
    return NextResponse.json(row)
  } catch (error) {
    return handleRouteError(error, customerConstraintMessages)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/customers/[id]">) {
  try {
    const row = await deleteCustomer(await currentDealershipId(), assertId((await params).id))
    if (!row) throw new HttpError(404, "Customer not found")
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
