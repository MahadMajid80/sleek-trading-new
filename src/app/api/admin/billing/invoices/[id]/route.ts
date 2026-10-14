import { NextResponse } from "next/server"
import { z } from "zod"

import { payInvoice, voidInvoice } from "@/features/billing/server"
import { assertId, handleRouteError, parseBody } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function POST(request: Request, { params }: RouteContext<"/api/admin/billing/invoices/[id]">) {
  try {
    await requireSuperAdmin()
    const id = assertId((await params).id)
    const { action } = await parseBody(request, z.object({ action: z.enum(["pay", "void"]) }))
    if (action === "void") {
      await voidInvoice(id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json(await payInvoice(null, id))
  } catch (error) {
    return handleRouteError(error)
  }
}
