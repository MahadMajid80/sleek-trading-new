import { NextResponse } from "next/server"
import { z } from "zod"

import { login } from "@/server/auth"
import { handleRouteError, parseBody } from "@/server/http"

export async function POST(request: Request) {
  try {
    const { email, password } = await parseBody(
      request,
      z.object({ email: z.email("Enter a valid email").max(120), password: z.string().min(1, "Enter your password").max(200) }),
    )
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
    const user = await login(email, password, ip)
    return NextResponse.json({ redirect: user.role === "super_admin" ? "/admin" : "/", mustChangePassword: user.mustChangePassword })
  } catch (error) {
    return handleRouteError(error)
  }
}
