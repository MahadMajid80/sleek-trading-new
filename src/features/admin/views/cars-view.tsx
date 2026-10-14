"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { CarFront } from "lucide-react"
import { useMemo } from "react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { FacetedFilter, NumberRangeFilter } from "@/components/data-table/filters"
import { Badge } from "@/components/ui/badge"
import type { CarRow } from "@/features/cars/schema"
import { StockBadge } from "@/features/cars/stock-badge"
import { formatNumber } from "@/lib/format"

import { useAdminOptions } from "../queries"
import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { Ago, DealershipCell, muted } from "./cells"

type Row = CarRow & { sold: boolean; dealershipCode: string; dealershipName: string }

const helper = createColumnHelper<AppFeatures, Row>()

export function AdminCarsView() {
  const options = useAdminOptions()

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("brand", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Vehicle" />,
          meta: { label: "Vehicle" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="flex min-w-48 items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <CarFront className="size-4" />
              </div>
              <div className="grid min-w-0">
                <span className="truncate font-medium">
                  {row.original.brand} {row.original.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.original.bodyType} · {row.original.color}
                </span>
              </div>
            </div>
          ),
        }),
        helper.accessor("dealershipCode", {
          header: "Dealership",
          meta: { label: "Dealership" },
          enableSorting: false,
          cell: ({ row }) => <DealershipCell code={row.original.dealershipCode} name={row.original.dealershipName} />,
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
        helper.accessor("cc", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Engine" />,
          meta: { label: "Engine (cc)" },
          cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue())} cc</span>,
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
          meta: { label: "Added" },
          cell: ({ getValue }) => <Ago value={getValue()} />,
        }),
      ]),
    [],
  )

  const { url, filters, query, table } = useAdminTable<
    Row,
    { brand: "multi"; body: "multi"; stock: "multi"; yearFrom: "number"; yearTo: "number" }
  >({
    resource: "vehicles",
    defaultSort: "createdAt.desc",
    spec: { brand: "multi", body: "multi", stock: "multi", yearFrom: "number", yearTo: "number" },
    columns,
    hidden: { chassisNo: false },
  })

  return (
    <AdminListPage
      title="Vehicles"
      description="every vehicle across all dealerships, available or sold"
      count={query.data?.rowCount}
      search={url.params.q}
      onSearch={url.setSearch}
      searchPlaceholder="Search make, reg no, chassis…"
      filters={
        <>
          <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
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
            options={(options.data?.brands ?? []).map((b) => ({ value: b.value, label: b.value, count: b.count }))}
          />
          <FacetedFilter
            title="Body"
            selected={filters.values.body}
            onChange={(v) => filters.set("body", v)}
            options={(options.data?.bodies ?? []).map((b) => ({ value: b.value, label: b.value, count: b.count }))}
          />
          <NumberRangeFilter
            title="Year"
            min={filters.values.yearFrom}
            max={filters.values.yearTo}
            format={String}
            placeholder={["From", "To"]}
            onChange={(yearFrom, yearTo) => filters.setMany({ yearFrom, yearTo })}
          />
        </>
      }
      activeFilters={filters.active}
      onResetFilters={filters.reset}
      table={table}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyIcon={CarFront}
      emptyTitle="No vehicles"
    />
  )
}
