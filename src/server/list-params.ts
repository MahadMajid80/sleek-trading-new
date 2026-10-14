import "server-only"

import { and, asc, desc, eq, ilike, inArray, or, type AnyColumn, type SQL } from "drizzle-orm"

export function parseListParams<S extends Record<string, AnyColumn | SQL>>(
  url: string,
  sortable: S,
  defaultSort: NoInfer<`${Extract<keyof S, string>}.${"asc" | "desc"}`>,
) {
  type K = Extract<keyof S, string>
  const params = new URL(url).searchParams
  const page = Math.max(1, Number(params.get("page")) || 1)
  const perPage = Math.min(100, Math.max(5, Number(params.get("perPage")) || 20))
  const q = (params.get("q") ?? "").trim().slice(0, 100)

  const [rawKey, rawDir] = (params.get("sort") ?? defaultSort).split(".")
  const [defaultKey, defaultDir] = defaultSort.split(".") as [K, "asc" | "desc"]
  const key = (rawKey && rawKey in sortable ? rawKey : defaultKey) as K
  const direction = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir
  const orderBy = direction === "asc" ? asc(sortable[key]) : desc(sortable[key])

  return { page, perPage, offset: (page - 1) * perPage, q, orderBy }
}

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)

// Every word must appear in at least one field ("toyota prado" → Toyota Land Cruiser Prado); order doesn't matter.
export function allWordsMatch(query: string, fields: (AnyColumn | SQL)[]) {
  const words = query.split(/\s+/).filter(Boolean).slice(0, 5)
  return and(...words.map((word) => or(...fields.map((field) => ilike(field, `%${escapeLike(word)}%`)))))
}

// Filter params arrive as plain query strings (written by nuqs on the client). Parse defensively: they're user input.
const param = (url: string, key: string) => new URL(url).searchParams.get(key)?.trim() ?? ""

/** Comma-separated multi-select, e.g. `?brand=Toyota,Mazda`. */
export const listParam = (url: string, key: string) =>
  param(url, key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 50)

export function enumListParam<T extends string>(url: string, key: string, allowed: readonly T[]) {
  return listParam(url, key).filter((value): value is T => (allowed as readonly string[]).includes(value))
}

export function numberParam(url: string, key: string) {
  const raw = param(url, key)
  const value = Number(raw)
  return raw !== "" && Number.isFinite(value) ? value : undefined
}

export function dateParam(url: string, key: string) {
  const raw = param(url, key)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
}

/**
 * Tenant scope for list queries. Staff pass their dealership id and only ever see it; the super admin passes `null`
 * and may narrow to specific dealerships with `?dealership=id,id`.
 */
export function dealershipScope(column: AnyColumn, scope: string | null, url: string) {
  if (scope) return eq(column, scope)
  const ids = listParam(url, "dealership").filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  return ids.length ? inArray(column, ids) : undefined
}
