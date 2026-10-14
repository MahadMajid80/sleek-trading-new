"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { ArrowRight, FileText, Wallet } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableSearch } from "@/components/data-table/data-table-search"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { appTableFeatures, type AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, NumberRangeFilter, ResetFilters, useTableFilters } from "@/components/data-table/filters"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { apiFetch, toSearchParams, type Paginated } from "@/lib/api-client"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"
import type { Jsonify } from "@/lib/types"

import type { PaymentListRow } from "./server"

type PaymentRow = Jsonify<PaymentListRow>

const helper = createColumnHelper<AppFeatures, PaymentRow>()
const EMPTY: PaymentRow[] = []

export function PaymentsView() {
  const router = useRouter()
  const url = useTableUrlState("paidOn.desc")
  const filters = useTableFilters({ from: "text", to: "text", minAmount: "number", maxAmount: "number" })
  const query = useQuery({
    queryKey: ["payments", "list", url.params, filters.params],
    queryFn: ({ signal }) => apiFetch<Paginated<PaymentRow>>(`/api/payments?${toSearchParams({ ...url.params, ...filters.params })}`, { signal }),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({
    queryKey: ["installments", "summary"],
    queryFn: ({ signal }) =>
      apiFetch<{ collectedThisMonth: number; paymentsThisMonth: number }>("/api/installments/summary", { signal }),
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("paidOn", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Paid on" />,
          meta: { label: "Paid on" },
          enableHiding: false,
          cell: ({ getValue }) => <span className="whitespace-nowrap font-medium">{format(parseISO(getValue()), "d MMM yyyy")}</span>,
        }),
        helper.accessor("agreementNumber", {
          header: "Agreement",
          meta: { label: "Agreement" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid">
              <Link
                href={`/agreements/${row.original.agreementId}` as Route}
                onClick={(event) => event.stopPropagation()}
                className="font-mono text-[14px] font-semibold underline-offset-4 hover:underline"
              >
                {formatAgreementNumber(row.original.agreementNumber, row.original.dealershipCode)}
              </Link>
              <span className="text-xs text-muted-foreground">Installment #{row.original.installmentSequence}</span>
            </div>
          ),
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
          meta: { label: "Amount", className: "text-right" },
          cell: ({ getValue }) => <span className="font-semibold tabular-nums">{formatKES(getValue())}</span>,
        }),
        helper.display({
          id: "effect",
          header: "Effect",
          meta: { label: "Effect" },
          cell: ({ row }) => {
            const { paidAhead, carried } = row.original
            if (!paidAhead && !carried) return <span className="text-sm text-muted-foreground">Exact</span>
            return (
              <span className="inline-flex items-center gap-1 text-sm">
                <ArrowRight className="size-3.5 text-muted-foreground" />
                {paidAhead > 0 ? (
                  <span className="text-success">{formatKES(paidAhead)} paid ahead</span>
                ) : (
                  <span className="text-warning">{formatKES(carried)} carried forward</span>
                )}
              </span>
            )
          },
        }),
        helper.accessor("notes", {
          header: "Notes",
          meta: { label: "Notes" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="line-clamp-1 max-w-48 text-sm text-muted-foreground">{getValue() ?? "—"}</span>,
        }),
        helper.display({
          id: "receipt",
          meta: { className: "w-28 text-right" },
          cell: ({ row }) => (
            <Button variant="ghost" size="sm" asChild onClick={(event) => event.stopPropagation()}>
              <a href={`/api/payments/${row.original.id}/receipt?inline=1`} target="_blank" rel="noreferrer">
                <FileText data-icon="inline-start" />
                Receipt
              </a>
            </Button>
          ),
        }),
      ]),
    [],
  )

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: query.data?.rows ?? EMPTY,
    rowCount: query.data?.rowCount ?? 0,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    initialState: { columnVisibility: { notes: false } },
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description={
          summary.data
            ? `${formatKESCompact(summary.data.collectedThisMonth)} collected this month across ${formatNumber(summary.data.paymentsThisMonth)} payments`
            : "Every installment payment received, newest first"
        }
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch value={url.params.q} onChange={url.setSearch} placeholder="Search SLK number, customer or notes…" />
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
          <ResetFilters active={filters.active} onReset={filters.reset} />
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>
        <DataTable
          table={table}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          onRowClick={(row) => router.push(`/agreements/${row.agreementId}` as Route)}
          empty={
            <DataTableEmpty
              error={query.error}
              onRetry={() => void query.refetch()}
              search={url.params.q || (filters.active ? "these filters" : "")}
              onClearSearch={() => {
                url.setSearch("")
                filters.reset()
              }}
              searchHint="Try an agreement number or customer name."
              icon={Wallet}
              title="No payments yet"
              description="Payments are recorded from a hire purchase agreement or the Installments page."
              addLabel="Go to installments"
              onAdd={() => router.push("/installments" as Route)}
            />
          }
        />
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
