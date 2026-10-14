import { NextResponse } from "next/server"

import { listPlans, planConstraintMessages, planSchema, savePlan } from "@/features/billing/server"
import { handleRouteError, parseBody } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET() {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await listPlans({ activeOnly: false }))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin()
    return NextResponse.json(await savePlan(null, await parseBody(request, planSchema)), { status: 201 })
  } catch (error) {
    return handleRouteError(error, planConstraintMessages)
  }
}
