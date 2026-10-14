"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { Receipt } from "lucide-react"
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo } from "react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter, NumberRangeFilter } from "@/components/data-table/filters"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { InvoiceRow } from "@/features/invoices/queries"
import { formatInvoiceNumber, invoiceKindMeta, type InvoiceKind } from "@/features/invoices/schema"
import { formatKESCompact } from "@/lib/format"

import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { Ago, DealershipCell, Money, muted } from "./cells"

const helper = createColumnHelper<AppFeatures, InvoiceRow>()
const KINDS = ["proforma", "final"] as const

export function AdminInvoicesView() {
  const [{ kind }, setTab] = useQueryStates(
    { kind: parseAsStringLiteral(KINDS).withDefault("proforma"), page: parseAsInteger },
    { history: "replace", clearOnDefault: true },
  )

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="No." />,
          meta: { label: "Number" },
          enableHiding: false,
          cell: ({ row }) => (
            <span className="font-mono font-medium whitespace-nowrap">{formatInvoiceNumber(kind, row.original.number)}</span>
          ),
        }),
        helper.accessor("dealershipCode", {
          header: "Dealership",
          meta: { label: "Dealership" },
          enableSorting: false,
          cell: ({ row }) => <DealershipCell code={row.original.dealershipCode} name={row.original.dealershipName} />,
        }),
        helper.accessor("status", {
          header: "Status",
          meta: { label: "Status" },
          enableSorting: false,
          cell: ({ row }) =>
            row.original.status === "draft" ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/12 text-warning">
                Draft
              </Badge>
            ) : (
              <Badge variant="outline" className="border-success/30 bg-success/12 text-success">
                {kind === "proforma" ? "Live" : "Issued"}
              </Badge>
            ),
        }),
        helper.accessor("customerName", {
          header: "Customer",
          meta: { label: "Customer" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid min-w-36">
              <span className="truncate font-medium">{row.original.customerName}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{row.original.customerPhone}</span>
            </div>
          ),
        }),
        helper.accessor("carTitle", {
          header: "Vehicle",
          meta: { label: "Vehicle" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid min-w-36">
              <span className="truncate">{row.original.carTitle}</span>
              <span className="font-mono text-xs text-muted-foreground">{row.original.carRegNo ?? muted}</span>
            </div>
          ),
        }),
        helper.accessor("agreedPrice", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
          meta: { label: "Price" },
          cell: ({ getValue }) => <Money value={getValue()} />,
        }),
        helper.accessor("balance", {
          header: "Balance",
          meta: { label: "Balance" },
          enableSorting: false,
          cell: ({ getValue }) => <Money value={getValue()} className="text-muted-foreground" />,
        }),
        helper.accessor("linkedNumber", {
          header: kind === "proforma" ? "Final invoice" : "From proforma",
          meta: { label: "Linked invoice" },
          enableSorting: false,
          cell: ({ getValue }) => {
            const linked = getValue()
            return linked ? (
              <span className="font-mono text-sm">{formatInvoiceNumber(kind === "proforma" ? "final" : "proforma", linked)}</span>
            ) : (
              muted
            )
          },
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
          meta: { label: "Created" },
          cell: ({ getValue }) => <Ago value={getValue()} />,
        }),
      ]),
    [kind],
  )

  const { url, filters, query, table } = useAdminTable<
    InvoiceRow,
    { status: "multi"; from: "text"; to: "text"; minPrice: "number"; maxPrice: "number" }
  >({
    resource: `invoices/${kind}`,
    defaultSort: "createdAt.desc",
    spec: { status: "multi", from: "text", to: "text", minPrice: "number", maxPrice: "number" },
    columns,
    hidden: { balance: false },
  })

  return (
    <AdminListPage
      title="Sales invoices"
      description={`${invoiceKindMeta[kind].title.toLowerCase()} from every dealership`}
      count={query.data?.rowCount}
      summary={
        <Tabs value={kind} onValueChange={(value) => void setTab({ kind: value as InvoiceKind, page: null })}>
          <TabsList>
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {invoiceKindMeta[k].title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
      search={url.params.q}
      onSearch={url.setSearch}
      searchPlaceholder="Search number, customer, vehicle…"
      filters={
        <>
          <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
          {kind === "proforma" && (
            <FacetedFilter
              title="Status"
              single
              selected={filters.values.status}
              onChange={(v) => filters.set("status", v)}
              options={[
                { value: "draft", label: "Draft" },
                { value: "live", label: "Live" },
              ]}
            />
          )}
          <DateRangeFilter
            title="Created"
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
      emptyIcon={Receipt}
      emptyTitle={`No ${invoiceKindMeta[kind].title.toLowerCase()}`}
    />
  )
}
