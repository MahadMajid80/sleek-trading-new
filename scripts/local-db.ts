import { existsSync } from "node:fs"
import net from "node:net"
import path from "node:path"

import EmbeddedPostgres from "embedded-postgres"

// Real PostgreSQL for local development, shipped as an npm package (no Docker/Homebrew). One server process owns the
// data directory, and every Next.js worker, script and tool connects to it over TCP like it would in production.

const DATA_DIR = path.resolve(".data/postgres")
// Override with LOCAL_DB_PORT (e.g. in .env.local) when 5433 is taken by another server.
const port = () => Number(process.env.LOCAL_DB_PORT || 5433)
const DATABASE = "sleek"

function isListening(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(port, "127.0.0.1")
    socket.once("connect", () => {
      socket.end()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })
}

/**
 * Makes sure a database is reachable. Uses DATABASE_URL when set, reuses a local server that is already running,
 * and otherwise starts the embedded one. `stop` only stops a server this call started.
 */
export async function ensureLocalDatabase(): Promise<{ started: boolean; stop: () => Promise<void> }> {
  if (process.env.DATABASE_URL) return { started: false, stop: async () => {} }
  if (await isListening(port())) return { started: false, stop: async () => {} }

  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: port(),
    user: "postgres",
    password: "postgres",
    persistent: true,
    onLog: () => {},
    onError: (message) => console.error("[postgres]", message),
  })

  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log("Initialising local PostgreSQL in .data/postgres …")
    await server.initialise()
  }
  await server.start()
  try {
    await server.createDatabase(DATABASE)
  } catch {
    // Already exists.
  }
  return { started: true, stop: () => server.stop() }
}
