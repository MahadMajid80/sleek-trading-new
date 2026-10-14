import { NextResponse } from "next/server"

import { listInvoices } from "@/features/invoices/server"
import { handleRouteError, HttpError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(request: Request, { params }: RouteContext<"/api/admin/invoices/[kind]">) {
  try {
    await requireSuperAdmin()
    const { kind } = await params
    if (kind !== "proforma" && kind !== "final") throw new HttpError(404, "Unknown invoice type")
    return NextResponse.json(await listInvoices(kind, null, request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}
