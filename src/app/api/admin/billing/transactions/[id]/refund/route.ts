import { NextResponse } from "next/server"

import { refundTransaction } from "@/features/billing/server"
import { assertId, handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function POST(_request: Request, { params }: RouteContext<"/api/admin/billing/transactions/[id]/refund">) {
  try {
    await requireSuperAdmin()
    await refundTransaction(assertId((await params).id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
