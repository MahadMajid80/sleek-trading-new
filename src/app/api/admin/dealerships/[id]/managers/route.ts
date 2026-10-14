import { NextResponse } from "next/server"

import { createManager, managerConstraintMessages, managerSchema } from "@/features/admin/dealership-server"
import { requireSuperAdmin } from "@/server/auth"
import { assertId, handleRouteError, parseBody } from "@/server/http"

export async function POST(request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]/managers">) {
  try {
    await requireSuperAdmin()
    const credentials = await createManager(assertId((await params).id), await parseBody(request, managerSchema))
    return NextResponse.json({ credentials }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, managerConstraintMessages)
  }
}
