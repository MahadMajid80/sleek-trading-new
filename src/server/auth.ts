import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { and, eq, gt, lt } from "drizzle-orm"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { db } from "@/db"
import { dealerships, sessions, users, type Dealership, type User } from "@/db/schema"

import { HttpError } from "./http"
import { DUMMY_HASH, verifyPassword } from "./password"

export const SESSION_COOKIE = "sleek_session"
const SESSION_DAYS = 14

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "mustChangePassword"> & {
  dealership: Dealership | null
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt })
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
  // Cheap housekeeping so the table doesn't grow forever.
  void db.delete(sessions).where(lt(sessions.expiresAt, new Date())).catch(() => {})
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
  jar.delete(SESSION_COOKIE)
}

/** Signs out every device of a user, e.g. after a password reset or when an account is disabled. */
export const endAllSessions = (userId: string) => db.delete(sessions).where(eq(sessions.userId, userId))

/**
 * The signed-in user, or null. A session only counts while the user is active and (for dealership admins) their
 * dealership isn't suspended, so suspending a dealership locks its managers out immediately.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const [row] = await db
    .select({ user: users, dealership: dealerships })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(dealerships, eq(dealerships.id, users.dealershipId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
  if (!row || row.user.status !== "active") return null
  if (row.user.role === "dealer_admin" && row.dealership?.status !== "active") return null
  const { id, email, name, role, mustChangePassword } = row.user
  return { id, email, name, role, mustChangePassword, dealership: row.dealership }
})

// ─── Guards for API routes (throw HttpError → handleRouteError turns it into JSON) ───────────────────────────────────

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new HttpError(401, "Please sign in")
  return user
}

export async function requireSuperAdmin() {
  const user = await requireUser()
  if (user.role !== "super_admin") throw new HttpError(403, "This area is for platform administrators")
  return user
}

/** A dealership admin, with their dealership. Super admins have no dealership and can't use dealership APIs. */
export async function requireDealerAdmin() {
  const user = await requireUser()
  if (user.role !== "dealer_admin" || !user.dealership) throw new HttpError(403, "This area is for dealership admins")
  return { ...user, dealership: user.dealership }
}

// ─── Guards for pages/layouts (redirect instead of throwing) ─────────────────────────────────────────────────────────

export async function requireDealerAdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role === "super_admin") redirect("/admin")
  return { ...user, dealership: user.dealership! }
}

export async function requireSuperAdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role !== "super_admin") redirect("/")
  return user
}

// ─── Login ───────────────────────────────────────────────────────────────────────────────────────────────────────────

// In-memory throttle: 8 failures per email+IP in 10 minutes. It resets on restart and isn't shared between instances;
// move it to the database or Redis if you run more than one server.
const attempts = new Map<string, { count: number; first: number }>()
const WINDOW_MS = 10 * 60_000
const MAX_FAILURES = 8

function throttle(key: string) {
  const entry = attempts.get(key)
  if (entry && Date.now() - entry.first > WINDOW_MS) attempts.delete(key)
  return (attempts.get(key)?.count ?? 0) >= MAX_FAILURES
}

function recordFailure(key: string) {
  const entry = attempts.get(key)
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() })
  else entry.count++
}

export async function login(email: string, password: string, ip: string) {
  const key = `${email.toLowerCase()}|${ip}`
  if (throttle(key)) throw new HttpError(429, "Too many attempts. Try again in a few minutes.")

  const [row] = await db
    .select({ user: users, dealership: dealerships })
    .from(users)
    .leftJoin(dealerships, eq(dealerships.id, users.dealershipId))
    .where(eq(users.email, email.toLowerCase()))
  // Always run a verification so a missing user takes as long as a wrong password.
  const valid = await verifyPassword(password, row?.user.passwordHash ?? DUMMY_HASH)
  if (!row || !valid) {
    recordFailure(key)
    throw new HttpError(401, "Email or password is incorrect")
  }
  if (row.user.status !== "active") throw new HttpError(403, "This account has been disabled. Contact your administrator.")
  if (row.user.role === "dealer_admin" && row.dealership?.status !== "active") {
    throw new HttpError(403, "This dealership is suspended. Contact the platform administrator.")
  }

  attempts.delete(key)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.user.id))
  await startSession(row.user.id)
  return row.user
}
