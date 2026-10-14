"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { FilePen } from "lucide-react"
import { useMemo } from "react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter, NumberRangeFilter } from "@/components/data-table/filters"
import { Badge } from "@/components/ui/badge"
import { HpProgress } from "@/features/agreements/agreements-view"
import type { AgreementRow } from "@/features/agreements/queries"
import { AGREEMENT_TYPES, agreementTypeMeta, formatAgreementNumber, typeBadgeClass } from "@/features/agreements/schema"
import { formatKESCompact } from "@/lib/format"

import { useAdminDialog } from "../ui/admin-dialogs"
import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { Ago, DealershipCell, Money, muted } from "./cells"

const helper = createColumnHelper<AppFeatures, AgreementRow>()

export function AdminAgreementsView() {
  const openDialog = useAdminDialog((state) => state.open)

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="No." />,
          meta: { label: "Number" },
          enableHiding: false,
          cell: ({ row }) => (
            <span className="font-mono font-medium whitespace-nowrap">{formatAgreementNumber(row.original.number, row.original.dealershipCode)}</span>
          ),
        }),
        helper.accessor("dealershipCode", {
          header: "Dealership",
          meta: { label: "Dealership" },
          enableSorting: false,
          cell: ({ row }) => <DealershipCell code={row.original.dealershipCode} name={row.original.dealershipName} />,
        }),
        helper.accessor("type", {
          header: "Type",
          meta: { label: "Type" },
          enableSorting: false,
          cell: ({ getValue }) => (
            <Badge variant="outline" className={typeBadgeClass[getValue()]}>
              {agreementTypeMeta[getValue()].short}
            </Badge>
          ),
        }),
        helper.accessor("buyerName", {
          header: "Customer",
          meta: { label: "Customer" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid min-w-36">
              <span className="truncate font-medium">{row.original.type === "buying" ? row.original.sellerName : row.original.buyerName}</span>
              <span className="text-xs text-muted-foreground">{row.original.type === "buying" ? "Seller" : "Buyer"}</span>
            </div>
          ),
        }),
        helper.accessor("carName", {
          header: "Vehicle",
          meta: { label: "Vehicle" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid min-w-40">
              <span className="truncate">
                {row.original.carYear} {row.original.carBrand} {row.original.carName}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{row.original.carRegNo ?? muted}</span>
            </div>
          ),
        }),
        helper.accessor("agreedPrice", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
          meta: { label: "Price" },
          cell: ({ getValue }) => <Money value={getValue()} />,
        }),
        helper.accessor("outstanding", {
          header: "Progress",
          meta: { label: "Progress" },
          enableSorting: false,
          cell: ({ row }) => <HpProgress row={row.original} />,
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Signed" />,
          meta: { label: "Signed" },
          cell: ({ getValue }) => <Ago value={getValue()} />,
        }),
      ]),
    [],
  )

  const { url, filters, query, table } = useAdminTable<
    AgreementRow,
    { type: "multi"; status: "multi"; from: "text"; to: "text"; minPrice: "number"; maxPrice: "number" }
  >({
    resource: "agreements",
    defaultSort: "createdAt.desc",
    spec: { type: "multi", status: "multi", from: "text", to: "text", minPrice: "number", maxPrice: "number" },
    columns,
  })

  return (
    <AdminListPage
      title="Agreements"
      description="cash sales, hire purchase and buying deals"
      count={query.data?.rowCount}
      search={url.params.q}
      onSearch={url.setSearch}
      searchPlaceholder="Search number, customer, vehicle, reg no…"
      filters={
        <>
          <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
          <FacetedFilter
            title="Type"
            selected={filters.values.type}
            onChange={(v) => filters.set("type", v)}
            options={AGREEMENT_TYPES.map((type) => ({ value: type, label: agreementTypeMeta[type].short }))}
          />
          <FacetedFilter
            title="Status"
            selected={filters.values.status}
            onChange={(v) => filters.set("status", v)}
            options={[
              { value: "overdue", label: <span className="text-destructive">Overdue</span>, keywords: "overdue" },
              { value: "on_track", label: "On track", keywords: "on track" },
              { value: "completed", label: <span className="text-success">Completed</span>, keywords: "completed" },
            ]}
          />
          <DateRangeFilter
            title="Signed"
            from={filters.values.from}
            to={filters.values.to}
            onChange={(from, to) => filters.setMany({ from: from || null, to: to || null })}
          />
          <NumberRangeFilter
            title="Price"
            min={filters.values.minPrice}
            max={filters.values.maxPrice}
            format={formatKESCompact}
            onChange={(minPrice, maxPrice) => filters.setMany({ minPrice, maxPrice })}
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
      onRowClick={(row) => openDialog({ type: "agreement", id: row.id })}
      emptyIcon={FilePen}
      emptyTitle="No agreements"
    />
  )
}
