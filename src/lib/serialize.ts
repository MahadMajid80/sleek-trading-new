import type { Jsonify } from "./types"

/** Gives server-loaded data exactly the shape the JSON API returns, so pages and client refetches agree. */
export const toJson = <T,>(value: T) => JSON.parse(JSON.stringify(value)) as Jsonify<T>
