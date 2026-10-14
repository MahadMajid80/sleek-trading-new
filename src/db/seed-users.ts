// Demo sign-ins and branding for the seeded data. Development only: these accounts exist so there is something to sign in
// with locally. On a real database, create the first super admin with `npm run user:create-super-admin`.

import { randomUUID } from "node:crypto"
import { copyFileSync, mkdirSync } from "node:fs"
import path from "node:path"

import { eq } from "drizzle-orm"

import { hashPassword } from "../server/password"

import type { Executor } from "../features/billing/sync"
import { dealerships, users } from "./schema"

/** The password every demo account uses. Override with SEED_PASSWORD. */
export const DEV_PASSWORD = process.env.SEED_PASSWORD || "AutoVault-dev-1"

export const SUPER_ADMIN_EMAIL = "super@autovault.test"

// One dealership admin per seeded dealership, keyed by the dealership's code.
const DEALERSHIP_ADMINS: Record<string, { name: string; email: string }> = {
  SLK: { name: "Wanjiru Kamau", email: "admin@sleektrading.test" },
  NRB: { name: "Brian Otieno", email: "admin@sleekmotors.test" },
  MSA: { name: "Fatuma Hassan", email: "admin@coastautos.test" },
  ELD: { name: "Kipchoge Ruto", email: "admin@riftcars.test" },
}

export async function seedUsers(db: Executor, dealershipsByCode: Map<string, string>) {
  const passwordHash = await hashPassword(DEV_PASSWORD)
  await db.insert(users).values({ email: SUPER_ADMIN_EMAIL, name: "Platform Admin", passwordHash, role: "super_admin" })
  let count = 1
  for (const [code, person] of Object.entries(DEALERSHIP_ADMINS)) {
    const dealershipId = dealershipsByCode.get(code)
    if (!dealershipId) continue
    await db.insert(users).values({ ...person, passwordHash, role: "dealer_admin", dealershipId })
    count++
  }
  return count
}

/** Sleek Trading keeps its own logo and title, as a dealership would after customising its dashboard. */
export async function seedBranding(db: Executor, dealershipsByCode: Map<string, string>) {
  const id = dealershipsByCode.get("SLK")
  if (!id) return
  const root = path.resolve(process.env.STORAGE_DIR ?? "./.data/uploads")
  const key = `logos/${id}/${randomUUID()}.png`
  mkdirSync(path.dirname(path.join(root, key)), { recursive: true })
  copyFileSync(path.resolve("public/brand/logo-dark.png"), path.join(root, key))
  await db
    .update(dealerships)
    .set({ brandTitle: "Sleek Trading", logoKey: key, logoMimeType: "image/png", logoWide: true })
    .where(eq(dealerships.id, id))
}
