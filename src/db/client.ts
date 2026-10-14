import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

/** Local embedded Postgres started by `npm run dev` / `npm run db:start` (see scripts/local-db.ts). */
export const localDatabaseUrl = () => `postgres://postgres:postgres@localhost:${process.env.LOCAL_DB_PORT || 5433}/sleek`

export const databaseUrl = () => process.env.DATABASE_URL || localDatabaseUrl()

export type Database = ReturnType<typeof createDatabase>["db"]

export function createDatabase(url = databaseUrl()) {
  const client = postgres(url, { max: 10, onnotice: () => {} })
  return {
    db: drizzle(client, { schema, casing: "snake_case" }),
    close: () => client.end(),
  }
}
