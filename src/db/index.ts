import "server-only"

import { createDatabase, type Database } from "./client"

// One pool per process, reused across dev hot reloads.
const globalForDb = globalThis as unknown as { __sleekDb?: ReturnType<typeof createDatabase> }

function getHandle() {
  globalForDb.__sleekDb ??= createDatabase()
  return globalForDb.__sleekDb
}

// Connects on first query rather than at import, so `next build` workers that merely load route modules never connect.
export const db = new Proxy({} as Database, {
  get: (_target, property) => Reflect.get(getHandle().db, property),
})

export * as schema from "./schema"
