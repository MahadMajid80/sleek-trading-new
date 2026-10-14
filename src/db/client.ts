import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

/** Local embedded Postgres started by `npm run dev` / `npm run db:start` (see scripts/local-db.ts). */
export const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:5433/sleek"

export const databaseUrl = () => process.env.DATABASE_URL || LOCAL_DATABASE_URL

export type Database = ReturnType<typeof createDatabase>["db"]

export function createDatabase(url = databaseUrl()) {
  const client = postgres(url, { max: 10, onnotice: () => {} })
  return {
    db: drizzle(client, { schema, casing: "snake_case" }),
    close: () => client.end(),
  }
}
