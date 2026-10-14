import { NextResponse } from "next/server"

import { carSchema } from "@/features/cars/schema"
import { carConstraintMessages, deleteCar, updateCar } from "@/features/cars/server"
import { assertId, handleRouteError, HttpError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function PATCH(request: Request, { params }: RouteContext<"/api/vehicles/[id]">) {
  try {
    const id = assertId((await params).id)
    const input = await parseBody(request, carSchema)
    const row = await updateCar(await currentDealershipId(), id, input)
    if (!row) throw new HttpError(404, "Vehicle not found")
    return NextResponse.json(row)
  } catch (error) {
    return handleRouteError(error, carConstraintMessages)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/vehicles/[id]">) {
  try {
    const row = await deleteCar(await currentDealershipId(), assertId((await params).id))
    if (!row) throw new HttpError(404, "Vehicle not found")
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
