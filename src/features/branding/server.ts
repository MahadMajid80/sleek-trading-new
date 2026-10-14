import "server-only"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { dealerships } from "@/db/schema"
import { HttpError } from "@/server/http"
import { deleteStoredFile, readStoredFile, saveFile, validateUpload } from "@/server/storage"

import { HEX } from "./theme"

// A dealership's own dashboard branding: title, logo and two colours. Used by the dealership admin (/settings) and, for any
// dealership, by the super admin.

const colour = z.union([z.literal(""), z.string().regex(HEX, "Use a colour like #0f2a4a")])

export const brandingSchema = z.object({
  brandTitle: z.string().trim().max(40, "Keep it under 40 characters"),
  sidebarColor: colour,
  accentColor: colour,
})
export type BrandingFormValues = z.input<typeof brandingSchema>

// PNG/JPEG/WebP only. SVG is deliberately excluded: an uploaded SVG can carry scripts.
export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

export async function updateBranding(dealershipId: string, input: z.output<typeof brandingSchema>) {
  const [row] = await db
    .update(dealerships)
    .set({
      brandTitle: input.brandTitle || null,
      sidebarColor: input.sidebarColor ? input.sidebarColor.toLowerCase() : null,
      accentColor: input.accentColor ? input.accentColor.toLowerCase() : null,
    })
    .where(eq(dealerships.id, dealershipId))
    .returning()
  if (!row) throw new HttpError(404, "Dealership not found")
  return row
}

export async function saveLogo(dealershipId: string, file: unknown, wide: boolean) {
  const logo = validateUpload(file, LOGO_TYPES, 1)
  const [current] = await db.select({ key: dealerships.logoKey }).from(dealerships).where(eq(dealerships.id, dealershipId))
  if (!current) throw new HttpError(404, "Dealership not found")
  const key = await saveFile(`logos/${dealershipId}`, logo, LOGO_TYPES)
  await db.update(dealerships).set({ logoKey: key, logoMimeType: logo.type, logoWide: wide }).where(eq(dealerships.id, dealershipId))
  if (current.key) await deleteStoredFile(current.key).catch(() => {})
}

export async function removeLogo(dealershipId: string) {
  const [current] = await db.select({ key: dealerships.logoKey }).from(dealerships).where(eq(dealerships.id, dealershipId))
  if (!current) throw new HttpError(404, "Dealership not found")
  await db.update(dealerships).set({ logoKey: null, logoMimeType: null, logoWide: false }).where(eq(dealerships.id, dealershipId))
  if (current.key) await deleteStoredFile(current.key).catch(() => {})
}

export async function readLogo(dealershipId: string) {
  const [row] = await db
    .select({ key: dealerships.logoKey, mime: dealerships.logoMimeType })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
  if (!row?.key || !row.mime) throw new HttpError(404, "No logo")
  return { body: await readStoredFile(row.key), mime: row.mime }
}

/** Reads the multipart body shared by both logo upload routes. */
export async function parseLogoUpload(request: Request) {
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "Upload the logo as form data")
  })
  return { file: form.get("file"), wide: form.get("wide") === "true" }
}
