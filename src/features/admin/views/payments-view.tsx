"use client"

import { useQuery } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { Paperclip, Receipt, Wallet } from "lucide-react"
import { useMemo } from "react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, NumberRangeFilter } from "@/components/data-table/filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { apiFetch } from "@/lib/api-client"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"

import { useAdminDialog } from "../ui/admin-dialogs"
import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { Ago, Day, DealershipCell, Money, StatTiles, TONES } from "./cells"

type Row = {
  id: string
  agreementId: string
  agreementNumber: number
  dealershipCode: string
  dealershipName: string
  customerName: string
  carTitle: string
  installmentSequence: number
  amount: number
  paidOn: string
  notes: string | null
  receiptName: string | null
  createdAt: string
  carried: number
  paidAhead: number
}

const helper = createColumnHelper<AppFeatures, Row>()

export function AdminPaymentsView() {
  const openDialog = useAdminDialog((state) => state.open)
  const summary = useQuery({
    queryKey: ["admin", "installments-summary"],
    queryFn: ({ signal }) =>
      apiFetch<{ collectedThisMonth: number; paymentsThisMonth: number; outstanding: number }>("/api/admin/installments/summary", { signal }),
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("paidOn", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Paid on" />,
          meta: { label: "Paid on" },
          enableHiding: false,
          cell: ({ getValue }) => <Day value={getValue()} />,
        }),
        helper.accessor("agreementNumber", {
          header: "Agreement",
          meta: { label: "Agreement" },
          enableSorting: false,
          cell: ({ row }) => (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-mono font-medium">{formatAgreementNumber(row.original.agreementNumber, row.original.dealershipCode)}</span>
              <span className="text-xs text-muted-foreground">#{row.original.installmentSequence}</span>
            </span>
          ),
        }),
        helper.accessor("dealershipCode", {
          header: "Dealership",
          meta: { label: "Dealership" },
          enableSorting: false,
          cell: ({ row }) => <DealershipCell code={row.original.dealershipCode} name={row.original.dealershipName} />,
        }),
        helper.accessor("customerName", {
          header: "Customer",
          meta: { label: "Customer" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid min-w-36">
              <span className="truncate font-medium">{row.original.customerName}</span>
              <span className="truncate text-xs text-muted-foreground">{row.original.carTitle}</span>
            </div>
          ),
        }),
        helper.accessor("amount", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
          meta: { label: "Amount" },
          cell: ({ row }) => (
            <div className="grid">
              <Money value={row.original.amount} className="text-success" />
              {row.original.paidAhead > 0 && (
                <span className="text-xs text-muted-foreground">{formatKES(row.original.paidAhead)} paid ahead</span>
              )}
              {row.original.carried > 0 && (
                <span className="text-xs text-warning">{formatKES(row.original.carried)} carried forward</span>
              )}
            </div>
          ),
        }),
        helper.accessor("notes", {
          header: "Notes",
          meta: { label: "Notes" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="line-clamp-1 max-w-56 text-sm text-muted-foreground">{getValue() || "—"}</span>,
        }),
        helper.accessor("receiptName", {
          header: "Receipt",
          meta: { label: "Receipt" },
          enableSorting: false,
          cell: ({ row }) =>
            row.original.receiptName ? (
              <Button variant="outline" size="sm" asChild onClick={(event) => event.stopPropagation()}>
                <a href={`/api/admin/payments/${row.original.id}/receipt`} target="_blank" rel="noreferrer">
                  <Paperclip data-icon="inline-start" />
                  View
                </a>
              </Button>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                None
              </Badge>
            ),
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Recorded" />,
          meta: { label: "Recorded" },
          cell: ({ getValue }) => <Ago value={getValue()} />,
        }),
      ]),
    [],
  )

  const { url, filters, query, table } = useAdminTable<
    Row,
    { from: "text"; to: "text"; minAmount: "number"; maxAmount: "number" }
  >({
    resource: "payments",
    defaultSort: "paidOn.desc",
    spec: { from: "text", to: "text", minAmount: "number", maxAmount: "number" },
    columns,
    hidden: { createdAt: false },
  })
  const s = summary.data

  return (
    <AdminListPage
      title="Customer payments"
      description="installment payments customers made to dealerships"
      count={query.data?.rowCount}
      summary={
        <StatTiles
          items={[
            {
              label: "Collected this month",
              value: s && formatKESCompact(s.collectedThisMonth),
              hint: s && `${formatNumber(s.paymentsThisMonth)} payments`,
              icon: Wallet,
              tone: TONES.mono,
            },
            {
              label: "Still outstanding",
              value: s && formatKESCompact(s.outstanding),
              hint: "Across all hire purchase agreements",
              icon: Receipt,
              tone: TONES.gold,
            },
            {
              label: "Payments matching",
              value: query.data && formatNumber(query.data.rowCount),
              hint: filters.active ? "With the filters below" : "All time",
              icon: Paperclip,
              tone: TONES.navy,
            },
          ]}
        />
      }
      search={url.params.q}
      onSearch={url.setSearch}
      searchPlaceholder="Search agreement, customer, notes…"
      filters={
        <>
          <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
          <DateRangeFilter
            title="Paid on"
            from={filters.values.from}
            to={filters.values.to}
            onChange={(from, to) => filters.setMany({ from: from || null, to: to || null })}
          />
          <NumberRangeFilter
            title="Amount"
            min={filters.values.minAmount}
            max={filters.values.maxAmount}
            format={formatKESCompact}
            onChange={(minAmount, maxAmount) => filters.setMany({ minAmount, maxAmount })}
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
      onRowClick={(row) => openDialog({ type: "agreement", id: row.agreementId })}
      emptyIcon={Wallet}
      emptyTitle="No payments"
    />
  )
}
