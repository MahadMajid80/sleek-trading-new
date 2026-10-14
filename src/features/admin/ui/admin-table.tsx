"use client"

import { useTable, type RowData } from "@tanstack/react-table"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableSearch } from "@/components/data-table/data-table-search"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { appTableFeatures, type AppTable } from "@/components/data-table/features"
import { FacetedFilter, ResetFilters, useTableFilters } from "@/components/data-table/filters"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { formatNumber } from "@/lib/format"

import { useAdminList, useAdminOptions } from "../queries"
import { AdminPageHeader } from "./admin-shell"
import { DealershipChip } from "./dealership-chip"

type FilterKind = "multi" | "text" | "number"
const EMPTY: never[] = []

/**
 * URL-synced sorting/paging + filters + data + table, for any admin list endpoint. Every admin table gets a
 * Dealership filter for free; `spec` adds the page's own filters.
 */
export function useAdminTable<TRow extends { id: string }, S extends Record<string, FilterKind>>({
  resource,
  defaultSort,
  spec,
  columns,
  hidden,
  extraParams,
}: {
  resource: string
  defaultSort: string
  spec: S
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[]
  hidden?: Record<string, boolean>
  extraParams?: Record<string, string>
}) {
  const url = useTableUrlState(defaultSort)
  const filters = useTableFilters({ dealership: "multi", ...spec } as S & { dealership: "multi" })
  const query = useAdminList<TRow>(resource, { ...url.params, ...filters.params, ...extraParams })
  const table = useTable({
    features: appTableFeatures,
    columns,
    data: (query.data?.rows ?? EMPTY) as TRow[],
    rowCount: query.data?.rowCount ?? 0,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    initialState: { columnVisibility: hidden ?? {} },
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })
  return { url, filters, query, table }
}

export function DealershipFilter({ selected, onChange }: { selected: string[]; onChange: (values: string[]) => void }) {
  const options = useAdminOptions()
  return (
    <FacetedFilter
      title="Dealership"
      selected={selected}
      onChange={onChange}
      options={(options.data?.dealerships ?? []).map((d) => ({
        value: d.id,
        label: d.name,
        keywords: `${d.code} ${d.city}`,
        icon: <DealershipChip code={d.code} />,
      }))}
    />
  )
}

export function AdminListPage<TRow extends RowData>({
  title,
  description,
  count,
  actions,
  summary,
  search,
  onSearch,
  searchPlaceholder,
  filters,
  activeFilters,
  onResetFilters,
  table,
  isLoading,
  isFetching,
  error,
  onRetry,
  onRowClick,
  emptyIcon,
  emptyTitle,
}: {
  title: string
  description: string
  count?: number
  actions?: ReactNode
  summary?: ReactNode
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  filters: ReactNode
  activeFilters: number
  onResetFilters: () => void
  table: AppTable<TRow>
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  onRetry: () => void
  onRowClick?: (row: TRow) => void
  emptyIcon: LucideIcon
  emptyTitle: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={title}
        description={count !== undefined ? `${formatNumber(count)} ${search || activeFilters ? "matching" : "across all dealerships"} · ${description}` : description}
        actions={actions}
      />
      {summary}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch value={search} onChange={onSearch} placeholder={searchPlaceholder} />
          {filters}
          <ResetFilters active={activeFilters} onReset={onResetFilters} />
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>
        <DataTable
          table={table}
          isLoading={isLoading}
          isFetching={isFetching}
          onRowClick={onRowClick}
          empty={
            <DataTableEmpty
              error={error}
              onRetry={onRetry}
              search={search || (activeFilters ? "these filters" : "")}
              onClearSearch={() => {
                onSearch("")
                onResetFilters()
              }}
              searchHint="Try removing a filter or searching for something else."
              icon={emptyIcon}
              title={emptyTitle}
              description="Nothing has been recorded yet."
              addLabel="Reset filters"
              onAdd={onResetFilters}
            />
          }
        />
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
