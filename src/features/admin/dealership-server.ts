import "server-only"

import { and, asc, eq, ne } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { dealerships, users } from "@/db/schema"
import { getBillingSummary, listPlans } from "@/features/billing/server"
import { isCountryCode } from "@/lib/countries"
import { endAllSessions } from "@/server/auth"
import { HttpError } from "@/server/http"
import { deleteStoredFile } from "@/server/storage"
import { generateTemporaryPassword, hashPassword } from "@/server/password"

import { pickCode } from "./dealership-code"
import { dealershipMetrics } from "./server"

// Super admin: creating and managing dealerships and the dealership admins ("managers") who sign in to them.

export const dealershipSchema = z.object({
  name: z.string().trim().min(2, "Enter the dealership name").max(80),
  country: z.string().refine(isCountryCode, "Choose a country"),
  city: z.string().trim().min(2, "Enter the city").max(40),
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?\d{9,14}$/, "Enter a valid phone number")]),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  status: z.enum(["active", "suspended"]),
})

// A new dealership must have contact details. Editing keeps them optional so older records without one can still be
// updated (for example suspended) without being forced to fill them in first.
export const createDealershipSchema = dealershipSchema.extend({
  phone: z.string().trim().min(1, "Enter the phone number").regex(/^\+?\d{9,14}$/, "Enter a valid phone number"),
  email: z.string().trim().min(1, "Enter the email address").pipe(z.email("Enter a valid email")),
  managerName: z.string().trim().min(2, "Enter the admin's name").max(80),
  managerEmail: z.email("Enter a valid email").max(120),
})

export const managerSchema = z.object({
  name: z.string().trim().min(2, "Enter the admin's name").max(80),
  email: z.email("Enter a valid email").max(120),
})

export type DealershipFormValues = z.input<typeof dealershipSchema>
export type CreateDealershipValues = z.input<typeof createDealershipSchema>
export type ManagerFormValues = z.input<typeof managerSchema>

export const managerConstraintMessages = {
  users_email_key: { field: "email", message: "Someone already uses this email address" },
}
export const createDealershipConstraintMessages = {
  users_email_key: { field: "managerEmail", message: "Someone already uses this email address" },
}

const toRecord = (input: z.output<typeof dealershipSchema>) => ({ ...input, phone: input.phone || null, email: input.email || null })

/** What the super admin hands to the new manager. Shown once; only the hash is stored. */
export type IssuedCredentials = { email: string; temporaryPassword: string }

async function insertManager(tx: Pick<typeof db, "insert">, dealershipId: string, input: z.output<typeof managerSchema>) {
  const temporaryPassword = generateTemporaryPassword()
  const email = input.email.toLowerCase()
  const [user] = await tx
    .insert(users)
    .values({
      email,
      name: input.name,
      passwordHash: await hashPassword(temporaryPassword),
      role: "dealer_admin",
      dealershipId,
      mustChangePassword: true,
    })
    .returning()
  return { user: user!, credentials: { email, temporaryPassword } satisfies IssuedCredentials }
}

export async function createDealership(input: z.output<typeof createDealershipSchema>) {
  const { managerName, managerEmail, ...rest } = input
  return db.transaction(async (tx) => {
    // The short code (agreement-number prefix) is generated from the name. If two dealerships are created at the same
    // moment and pick the same code, the unique index rejects one insert and we simply pick the next candidate.
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = new Set((await tx.select({ code: dealerships.code }).from(dealerships)).map((row) => row.code))
      const code = pickCode(rest.name, taken)
      const [dealership] = await tx
        .insert(dealerships)
        .values({ ...toRecord(rest), code })
        .onConflictDoNothing({ target: dealerships.code })
        .returning()
      if (!dealership) continue
      const { credentials } = await insertManager(tx, dealership.id, { name: managerName, email: managerEmail })
      return { dealership, credentials }
    }
    throw new HttpError(409, "Couldn't generate a unique code for this dealership. Try a slightly different name.")
  })
}

export async function updateDealership(id: string, input: z.output<typeof dealershipSchema>) {
  // Suspending needs no extra work: getCurrentUser() checks the dealership's status, so its admins are signed out at once.
  const [row] = await db.update(dealerships).set(toRecord(input)).where(eq(dealerships.id, id)).returning()
  return row
}

/** Only empty dealerships can be deleted; ones with history should be suspended instead (FKs enforce this). */
export async function deleteDealership(id: string) {
  const row = await db.transaction(async (tx) => {
    // Managers belong to the dealership; remove them with it. Everything else (customers, agreements…) blocks the delete.
    await tx.delete(users).where(eq(users.dealershipId, id))
    const [deleted] = await tx.delete(dealerships).where(eq(dealerships.id, id)).returning({ id: dealerships.id, logoKey: dealerships.logoKey })
    return deleted
  })
  if (row?.logoKey) await deleteStoredFile(row.logoKey).catch(() => {})
  return row && { id: row.id }
}

// ─── Managers ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const listManagers = (dealershipId: string) =>
  db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.dealershipId, dealershipId), eq(users.role, "dealer_admin")))
    .orderBy(asc(users.createdAt))

export async function createManager(dealershipId: string, input: z.output<typeof managerSchema>) {
  const [dealership] = await db.select({ id: dealerships.id }).from(dealerships).where(eq(dealerships.id, dealershipId))
  if (!dealership) throw new HttpError(404, "Dealership not found")
  return (await insertManager(db, dealershipId, input)).credentials
}

async function managerOf(dealershipId: string, userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.dealershipId, dealershipId), eq(users.role, "dealer_admin")))
  if (!user) throw new HttpError(404, "Admin not found")
  return user
}

export async function resetManagerPassword(dealershipId: string, userId: string): Promise<IssuedCredentials> {
  const user = await managerOf(dealershipId, userId)
  const temporaryPassword = generateTemporaryPassword()
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true })
    .where(eq(users.id, user.id))
  await endAllSessions(user.id)
  return { email: user.email, temporaryPassword }
}

export async function setManagerStatus(dealershipId: string, userId: string, status: "active" | "disabled") {
  const user = await managerOf(dealershipId, userId)
  if (status === "disabled") {
    const otherActive = await db.$count(
      users,
      and(eq(users.dealershipId, dealershipId), eq(users.role, "dealer_admin"), eq(users.status, "active"), ne(users.id, user.id)),
    )
    if (otherActive === 0) throw new HttpError(409, "A dealership needs at least one active admin. Add another first, or suspend the dealership.")
  }
  await db.update(users).set({ status }).where(eq(users.id, user.id))
  if (status === "disabled") await endAllSessions(user.id)
}

// ─── Detail ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function getDealershipDetail(id: string) {
  const [dealership] = await dealershipMetrics().where(eq(dealerships.id, id))
  if (!dealership) throw new HttpError(404, "Dealership not found")
  const [managers, billing, plans] = await Promise.all([
    listManagers(id),
    getBillingSummary(id),
    // Public plans plus any custom plans made for this dealership, active or not.
    listPlans({ activeOnly: false, dealershipId: id }),
  ])
  return { dealership, managers, billing, plans }
}
export type DealershipDetail = Awaited<ReturnType<typeof getDealershipDetail>>
