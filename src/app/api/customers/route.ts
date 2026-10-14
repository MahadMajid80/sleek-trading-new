import { NextResponse } from "next/server"

import { customerSchema } from "@/features/customers/schema"
import { createCustomer, customerConstraintMessages, listCustomers } from "@/features/customers/server"
import { handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listCustomers(await currentDealershipId(), request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, customerSchema)
    return NextResponse.json(await createCustomer(await currentDealershipId(), input), { status: 201 })
  } catch (error) {
    return handleRouteError(error, customerConstraintMessages)
  }
}
