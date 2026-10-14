import { NextResponse } from "next/server"
import { z } from "zod"

import { resetManagerPassword, setManagerStatus } from "@/features/admin/dealership-server"
import { requireSuperAdmin } from "@/server/auth"
import { assertId, handleRouteError, parseBody } from "@/server/http"

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_password") }),
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
])

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/dealerships/[id]/managers/[userId]">) {
  try {
    await requireSuperAdmin()
    const { id, userId } = await params
    const input = await parseBody(request, schema)
    if (input.action === "reset_password") {
      return NextResponse.json({ credentials: await resetManagerPassword(assertId(id), assertId(userId)) })
    }
    await setManagerStatus(assertId(id), assertId(userId), input.action === "disable" ? "disabled" : "active")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
