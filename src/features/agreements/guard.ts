import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { agreements } from "@/db/schema"
import { HttpError } from "@/server/http"

/** 404s unless the agreement exists in this dealership (null scope = super admin, any dealership). */
export async function assertAgreementInScope(scope: string | null, agreementId: string) {
  const found = await db.$count(
    agreements,
    and(eq(agreements.id, agreementId), scope ? eq(agreements.dealershipId, scope) : undefined),
  )
  if (!found) throw new HttpError(404, "Agreement not found")
}
