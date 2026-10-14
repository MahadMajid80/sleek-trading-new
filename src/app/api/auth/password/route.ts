import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/db"
import { users } from "@/db/schema"
import { endAllSessions, requireUser, startSession } from "@/server/auth"
import { handleRouteError, HttpError, parseBody } from "@/server/http"
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "@/server/password"

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(200),
})

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const { currentPassword, newPassword } = await parseBody(request, schema)
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id))
    if (!row || !(await verifyPassword(currentPassword, row.hash))) {
      throw new HttpError(422, "Your current password is incorrect", { currentPassword: "Your current password is incorrect" })
    }
    if (currentPassword === newPassword) {
      throw new HttpError(422, "Choose a different password", { newPassword: "Choose a password you haven't used just now" })
    }
    await db.update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false }).where(eq(users.id, user.id))
    // Sign out every other device, and keep this one signed in with a fresh session.
    await endAllSessions(user.id)
    await startSession(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
