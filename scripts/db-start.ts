import { ensureLocalDatabase } from "./local-db"

// `npm run db:start`: run local Postgres on its own (e.g. for Drizzle Studio or psql) until Ctrl+C.
async function main() {
  const database = await ensureLocalDatabase()
  if (!database.started) {
    console.log("A database is already running (or DATABASE_URL is set) — nothing to start.")
    return
  }
  console.log(`PostgreSQL running on localhost:${process.env.LOCAL_DB_PORT || 5433} — press Ctrl+C to stop.`)
  const stop = async () => {
    await database.stop()
    process.exit(0)
  }
  process.on("SIGINT", () => void stop())
  process.on("SIGTERM", () => void stop())
  setInterval(() => {}, 1 << 30)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
