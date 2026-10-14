"use client"

import { createColumnHelper, useTable } from "@tanstack/react-table"
import { formatDistanceToNowStrict } from "date-fns"
import { CarFront, Plus } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableSearch } from "@/components/data-table/data-table-search"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { appTableFeatures, type AppFeatures } from "@/components/data-table/features"
import { FacetedFilter, NumberRangeFilter, ResetFilters, useTableFilters } from "@/components/data-table/filters"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { PageHeader } from "@/components/page-header"
import { RowActions } from "@/components/row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { useDialogStore } from "@/stores/dialog-store"

import { carsResource, useCarFacets } from "./queries"
import { carTitle, type CarRow } from "./schema"
import { StockBadge } from "./stock-badge"

type Row = CarRow & { sold: boolean }

const helper = createColumnHelper<AppFeatures, Row>()
const EMPTY: Row[] = []

// "Pearl White" → "white": good enough for a swatch; unknown names render as an outlined empty dot.
const swatch = (color: string) => color.trim().split(/\s+/).pop()?.toLowerCase() ?? "transparent"

const muted = <span className="text-muted-foreground">—</span>

export function CarsView() {
  const url = useTableUrlState("createdAt.desc")
  const filters = useTableFilters({ brand: "multi", body: "multi", stock: "multi", yearFrom: "number", yearTo: "number" })
  const facets = useCarFacets()
  const query = carsResource.useList({ ...url.params, ...filters.params })
  const remove = carsResource.useDelete()
  const openDialog = useDialogStore((state) => state.open)
  const confirm = useConfirmState<CarRow>()
  const requestDelete = confirm.request

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("brand", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Vehicle" />,
          meta: { label: "Vehicle" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="flex min-w-48 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-accent-foreground">
                <CarFront className="size-4" />
              </div>
              <div className="grid min-w-0">
                <span className="truncate font-medium">
                  {row.original.brand} {row.original.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{row.original.bodyType}</span>
              </div>
            </div>
          ),
        }),
        helper.accessor("sold", {
          header: "Availability",
          meta: { label: "Availability" },
          enableSorting: false,
          cell: ({ getValue }) => <StockBadge sold={getValue()} />,
        }),
        helper.accessor("year", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Year" />,
          meta: { label: "Year" },
          cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("regNo", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Reg No" />,
          meta: { label: "Registration No" },
          cell: ({ getValue }) => {
            const reg = getValue()
            return reg ? (
              <Badge variant="outline" className="font-mono tracking-wider">
                {reg.replace(/^([A-Z]{3})(\d{3}[A-Z]?)$/, "$1 $2")}
              </Badge>
            ) : (
              muted
            )
          },
        }),
        helper.accessor("chassisNo", {
          header: "Chassis No",
          meta: { label: "Chassis No" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue() ?? muted}</span>,
        }),
        helper.accessor("engineNo", {
          header: "Engine No",
          meta: { label: "Engine No" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue() ?? muted}</span>,
        }),
        helper.accessor("color", {
          header: "Color",
          meta: { label: "Color" },
          enableSorting: false,
          cell: ({ getValue }) => (
            <span className="inline-flex items-center gap-2">
              <span
                className="size-3 rounded-full ring-1 ring-foreground/20"
                style={{ backgroundColor: swatch(getValue()) }}
                aria-hidden
              />
              {getValue()}
            </span>
          ),
        }),
        helper.accessor("cc", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Engine" />,
          meta: { label: "Engine (cc)" },
          cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue())} cc</span>,
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
          meta: { label: "Added" },
          cell: ({ getValue }) => (
            <time dateTime={getValue()} className="text-muted-foreground" title={new Date(getValue()).toLocaleString()}>
              {formatDistanceToNowStrict(new Date(getValue()), { addSuffix: true })}
            </time>
          ),
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => (
            <RowActions
              label={carTitle(row.original)}
              onEdit={() => openDialog({ type: "car-form", car: row.original })}
              onDelete={() => requestDelete(row.original)}
              copy={
                row.original.chassisNo ? { label: "Chassis number", value: row.original.chassisNo } : undefined
              }
            />
          ),
        }),
      ]),
    [openDialog, requestDelete],
  )

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: (query.data?.rows as Row[] | undefined) ?? EMPTY,
    rowCount: query.data?.rowCount ?? 0,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    initialState: { columnVisibility: { engineNo: false } },
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })

  const confirmDelete = () => {
    const car = confirm.item
    if (!car) return
    confirm.onOpenChange(false)
    remove.mutate(car.id, {
      onSuccess: () => toast.success("Vehicle deleted", { description: carTitle(car) }),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete vehicle"),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vehicles"
        description={
          query.data
            ? `${formatNumber(query.data.rowCount)} ${url.params.q || filters.active ? "matching" : "total"} · vehicles and trade-ins`
            : "Vehicles and trade-ins"
        }
        actions={
          <Button size="lg" onClick={() => openDialog({ type: "car-form" })}>
            <Plus data-icon="inline-start" />
            Add vehicle
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch
            value={url.params.q}
            onChange={url.setSearch}
            placeholder="Search make, reg no, chassis…"
          />
          <FacetedFilter
            title="Availability"
            single
            selected={filters.values.stock}
            onChange={(v) => filters.set("stock", v)}
            options={[
              { value: "in_stock", label: "Available" },
              { value: "sold", label: "Sold" },
            ]}
          />
          <FacetedFilter
            title="Make"
            selected={filters.values.brand}
            onChange={(v) => filters.set("brand", v)}
            options={(facets.data?.brands ?? []).map((b) => ({ value: b.value, label: b.value, count: b.count }))}
          />
          <FacetedFilter
            title="Body"
            selected={filters.values.body}
            onChange={(v) => filters.set("body", v)}
            options={(facets.data?.bodies ?? []).map((b) => ({ value: b.value, label: b.value, count: b.count }))}
          />
          <NumberRangeFilter
            title="Year"
            min={filters.values.yearFrom}
            max={filters.values.yearTo}
            format={String}
            placeholder={["From", "To"]}
            onChange={(yearFrom, yearTo) => filters.setMany({ yearFrom, yearTo })}
          />
          <ResetFilters active={filters.active} onReset={filters.reset} />
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>

        <DataTable
          table={table}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          onRowClick={(car) => openDialog({ type: "car-form", car })}
          empty={
            <DataTableEmpty
              error={query.error}
              onRetry={() => void query.refetch()}
              search={url.params.q || (filters.active ? "these filters" : "")}
              onClearSearch={() => {
                url.setSearch("")
                filters.reset()
              }}
              searchHint="Try a different make, registration or chassis number."
              icon={CarFront}
              title="No vehicles yet"
              description="Add vehicles so they can be sold or used as trade-ins."
              addLabel="Add vehicle"
              onAdd={() => openDialog({ type: "car-form" })}
            />
          }
        />

        <DataTablePagination table={table} />
      </div>

      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete ${confirm.item ? carTitle(confirm.item) : "car"}?`}
        description="This permanently removes the vehicle. Vehicles used in agreements or invoices can't be deleted."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
