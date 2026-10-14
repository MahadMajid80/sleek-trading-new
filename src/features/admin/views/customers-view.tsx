"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { Users } from "lucide-react"
import { useMemo } from "react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter } from "@/components/data-table/filters"
import { Badge } from "@/components/ui/badge"
import type { CustomerRow } from "@/features/customers/schema"

import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { Ago, DealershipCell, muted } from "./cells"

type Row = CustomerRow & { dealershipCode: string; dealershipName: string; agreementCount: number }

const helper = createColumnHelper<AppFeatures, Row>()

export function AdminCustomersView() {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
          meta: { label: "Customer" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="flex min-w-48 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {row.original.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="grid min-w-0">
                <span className="truncate font-medium">{row.original.name}</span>
                <span className="truncate text-xs text-muted-foreground">{row.original.email ?? "No email"}</span>
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
        helper.accessor("telephone", {
          header: "Phone",
          meta: { label: "Phone" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue()}</span>,
        }),
        helper.accessor("nationalId", {
          header: "National ID",
          meta: { label: "National ID" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue()}</span>,
        }),
        helper.accessor("kraPin", {
          header: "KRA PIN",
          meta: { label: "KRA PIN" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue() ?? muted}</span>,
        }),
        helper.accessor("agreementCount", {
          header: "Deals",
          meta: { label: "Deals" },
          enableSorting: false,
          cell: ({ getValue }) =>
            getValue() > 0 ? (
              <Badge variant="outline" className="border-(--signal)/40 bg-(--signal)/12 tabular-nums">
                {getValue()} {getValue() === 1 ? "deal" : "deals"}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            ),
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
          meta: { label: "Added" },
          cell: ({ getValue }) => <Ago value={getValue()} />,
        }),
      ]),
    [],
  )

  const { url, filters, query, table } = useAdminTable<Row, { deals: "multi"; from: "text"; to: "text" }>({
    resource: "customers",
    defaultSort: "createdAt.desc",
    spec: { deals: "multi", from: "text", to: "text" },
    columns,
    hidden: { kraPin: false },
  })

  return (
    <AdminListPage
      title="Customers"
      description="buyers, sellers, witnesses and next of kin"
      count={query.data?.rowCount}
      search={url.params.q}
      onSearch={url.setSearch}
      searchPlaceholder="Search name, phone, ID, KRA PIN…"
      filters={
        <>
          <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
          <FacetedFilter
            title="Deals"
            single
            selected={filters.values.deals}
            onChange={(v) => filters.set("deals", v)}
            options={[
              { value: "with", label: "Has agreements" },
              { value: "without", label: "No agreements" },
            ]}
          />
          <DateRangeFilter
            title="Added"
            from={filters.values.from}
            to={filters.values.to}
            onChange={(from, to) => filters.setMany({ from: from || null, to: to || null })}
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
      emptyIcon={Users}
      emptyTitle="No customers"
    />
  )
}
