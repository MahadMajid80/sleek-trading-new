import { config } from "dotenv"

import { createSuperAdmin } from "../src/db/create-super-admin"
import { runMigrations } from "../src/db/migrate"
import { runSeed } from "../src/db/seed"

import { ensureLocalDatabase } from "./local-db"

config({ path: [".env.local", ".env"], quiet: true })

// `tsx scripts/db-task.ts migrate|seed` — starts local Postgres for the duration if it isn't running.
const tasks = {
  migrate: runMigrations,
  seed: runSeed,
  // tsx scripts/db-task.ts super-admin you@example.com "Your Name"
  "super-admin": () => createSuperAdmin(process.argv[3], process.argv[4] ?? "Platform Admin"),
}
const name = process.argv[2] as keyof typeof tasks

async function main() {
  if (!tasks[name]) throw new Error(`Unknown task "${process.argv[2]}". Use: ${Object.keys(tasks).join(", ")}`)
  const database = await ensureLocalDatabase()
  try {
    await tasks[name]()
    if (name === "migrate") console.log("Migrations applied.")
  } finally {
    await database.stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
