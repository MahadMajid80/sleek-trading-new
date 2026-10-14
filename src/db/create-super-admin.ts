import { config } from "dotenv"
import { eq } from "drizzle-orm"

import { generateTemporaryPassword, hashPassword, PASSWORD_MIN_LENGTH } from "../server/password"

import { createDatabase } from "./client"
import { users } from "./schema"

config({ path: [".env.local", ".env"], quiet: true })

/**
 * Creates a super admin (or, if the email already belongs to one, resets their password). Use it to bootstrap a real
 * database: `npm run user:create-super-admin -- you@example.com "Your Name"`.
 * The password comes from SUPER_ADMIN_PASSWORD if set, otherwise a random one is generated and printed once.
 */
export async function createSuperAdmin(emailArg: string | undefined, name: string) {
  const email = emailArg?.trim().toLowerCase()
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Usage: npm run user:create-super-admin -- you@example.com "Your Name"')
  const supplied = process.env.SUPER_ADMIN_PASSWORD
  if (supplied && supplied.length < PASSWORD_MIN_LENGTH) throw new Error(`SUPER_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`)
  const password = supplied || generateTemporaryPassword(16)
  const passwordHash = await hashPassword(password)

  const { db, close } = createDatabase()
  try {
    const [existing] = await db.select().from(users).where(eq(users.email, email))
    if (existing && existing.role !== "super_admin") throw new Error(`${email} already belongs to a dealership admin`)
    if (existing) await db.update(users).set({ passwordHash, mustChangePassword: false, status: "active" }).where(eq(users.id, existing.id))
    else await db.insert(users).values({ email, name, passwordHash, role: "super_admin" })
    console.log(`${existing ? "Reset the password for" : "Created super admin"} ${email}`)
    if (!supplied) console.log(`Password (shown once): ${password}`)
  } finally {
    await close()
  }
}
