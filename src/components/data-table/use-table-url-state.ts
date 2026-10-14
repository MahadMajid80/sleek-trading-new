"use client"

import type { PaginationState, SortingState, Updater } from "@tanstack/react-table"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { useMemo } from "react"

const resolve = <T,>(updater: Updater<T>, current: T) =>
  typeof updater === "function" ? (updater as (old: T) => T)(current) : updater

// Table state lives in the URL so filtered/sorted views survive reloads, can be shared, and work with Back.
export function useTableUrlState(defaultSort: string, defaultPerPage = 20) {
  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(defaultPerPage),
      sort: parseAsString.withDefault(defaultSort),
      q: parseAsString.withDefault(""),
    },
    { history: "replace", clearOnDefault: true },
  )

  const sorting = useMemo<SortingState>(() => {
    const [id, dir] = params.sort.split(".")
    return id ? [{ id, desc: dir === "desc" }] : []
  }, [params.sort])

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: params.page - 1, pageSize: params.perPage }),
    [params.page, params.perPage],
  )

  return {
    params,
    sorting,
    pagination,
    onSortingChange: (updater: Updater<SortingState>) => {
      const [next] = resolve(updater, sorting)
      void setParams({ sort: next ? `${next.id}.${next.desc ? "desc" : "asc"}` : defaultSort, page: 1 })
    },
    onPaginationChange: (updater: Updater<PaginationState>) => {
      const next = resolve(updater, pagination)
      void setParams({
        page: next.pageSize !== pagination.pageSize ? 1 : next.pageIndex + 1,
        perPage: next.pageSize,
      })
    },
    setSearch: (q: string) => void setParams({ q, page: 1 }),
  }
}
