import { config } from "dotenv"
import { migrate } from "drizzle-orm/postgres-js/migrator"

import { createDatabase } from "./client"

config({ path: [".env.local", ".env"], quiet: true })

export async function runMigrations() {
  const { db, close } = createDatabase()
  await migrate(db, { migrationsFolder: "./drizzle" })
  await close()
}
