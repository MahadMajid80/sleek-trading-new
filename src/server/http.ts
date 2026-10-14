import "server-only"

import { NextResponse } from "next/server"
import type { z } from "zod"

type PgError = { code?: string; constraint?: string; constraint_name?: string; message?: string; cause?: unknown }

// Drizzle wraps driver errors; the Postgres code/constraint live somewhere down the cause chain.
function findPgError(error: unknown): PgError | undefined {
  let current = error as PgError | undefined
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.code === "string" && /^\d{2}[0-9A-Z]{3}$/.test(current.code)) return current
    current = current.cause as PgError | undefined
  }
  return undefined
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message)
  }
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  const json = await request.json().catch(() => {
    throw new HttpError(400, "Request body must be valid JSON")
  })
  const result = schema.safeParse(json)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join(".")
      fieldErrors[key] ??= issue.message
    }
    throw new HttpError(422, "Please fix the highlighted fields", fieldErrors)
  }
  return result.data
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertId(id: string) {
  if (!UUID.test(id)) throw new HttpError(404, "Not found")
  return id
}

type ConstraintMessages = Record<string, { field: string; message: string }>

export function handleRouteError(error: unknown, constraints: ConstraintMessages = {}) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: error.status })
  }

  const pg = findPgError(error)
  if (pg?.code === "23505") {
    const known = constraints[pg.constraint ?? pg.constraint_name ?? ""]
    return NextResponse.json(
      {
        error: known?.message ?? "A record with these details already exists",
        fieldErrors: known ? { [known.field]: known.message } : undefined,
      },
      { status: 409 },
    )
  }
  // 23503 foreign_key_violation (NO ACTION) and 23001 restrict_violation (ON DELETE RESTRICT).
  if (pg?.code === "23503" || pg?.code === "23001") {
    // Same code for "you referenced something that doesn't exist" (insert) and "others still reference this" (delete).
    const referencingMissing = /insert or update/i.test(pg.message ?? "")
    return NextResponse.json(
      {
        error: referencingMissing
          ? "One of the selected records no longer exists. Refresh and try again."
          : "This record is linked to other records (e.g. agreements or payments) and can't be removed",
      },
      { status: 409 },
    )
  }
  if (pg?.code === "23514") {
    return NextResponse.json({ error: "Some values aren't valid for this record" }, { status: 422 })
  }

  console.error(error)
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
}
