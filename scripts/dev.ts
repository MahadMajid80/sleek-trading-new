import { spawn } from "node:child_process"

import { ensureLocalDatabase } from "./local-db"

// `npm run dev`: start local Postgres (unless DATABASE_URL points elsewhere), then Next.js; stop both together.
async function main() {
  const database = await ensureLocalDatabase()
  if (database.started) console.log("PostgreSQL running on localhost:5433")

  const next = spawn("npx", ["next", "dev", ...process.argv.slice(2)], { stdio: "inherit", env: process.env })

  let stopping = false
  const shutdown = async (code: number) => {
    if (stopping) return
    stopping = true
    next.kill("SIGTERM")
    await database.stop()
    process.exit(code)
  }
  next.on("exit", (code) => void shutdown(code ?? 0))
  process.on("SIGINT", () => void shutdown(0))
  process.on("SIGTERM", () => void shutdown(0))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
