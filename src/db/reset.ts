import { rm } from "node:fs/promises"

import { config } from "dotenv"
import { sql } from "drizzle-orm"

import { ensureLocalDatabase } from "../../scripts/local-db"

import { createDatabase, databaseUrl, LOCAL_DATABASE_URL } from "./client"
import { runMigrations } from "./migrate"
import { runSeed } from "./seed"

config({ path: [".env.local", ".env"], quiet: true })

// Destructive: only ever allowed against the local development database.
async function main() {
  if (databaseUrl() !== LOCAL_DATABASE_URL) {
    throw new Error("db:reset only runs against the local development database. Unset DATABASE_URL to use it.")
  }
  const database = await ensureLocalDatabase()
  const { db, close } = createDatabase()
  await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`)
  await close()
  await rm(".data/uploads", { recursive: true, force: true })
  await runMigrations()
  await runSeed()
  await database.stop()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
