import { NextResponse } from "next/server"

import { createDealership, createDealershipConstraintMessages, createDealershipSchema } from "@/features/admin/dealership-server"
import { listDealerships } from "@/features/admin/server"
import { requireSuperAdmin } from "@/server/auth"
import { handleRouteError, parseBody } from "@/server/http"

export async function GET(request: Request) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listDealerships(request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}

/** Creates the dealership and its first admin. The response carries that admin's temporary password, once. */
export async function POST(request: Request) {
  try {
    await requireSuperAdmin()
    const { dealership, credentials } = await createDealership(await parseBody(request, createDealershipSchema))
    return NextResponse.json({ dealership, credentials }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, createDealershipConstraintMessages)
  }
}
