import { NextResponse } from "next/server"

import { carSchema } from "@/features/cars/schema"
import { carConstraintMessages, createCar, listCars } from "@/features/cars/server"
import { handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listCars(await currentDealershipId(), request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, carSchema)
    return NextResponse.json(await createCar(await currentDealershipId(), input), { status: 201 })
  } catch (error) {
    return handleRouteError(error, carConstraintMessages)
  }
}
