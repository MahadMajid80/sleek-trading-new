"use client"

import { createColumnHelper, useTable } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { CheckCircle2, CircleAlert, Clock, Webhook } from "lucide-react"
import { useMemo } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { appTableFeatures, type AppFeatures } from "@/components/data-table/features"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { useRevenueOverview, type BillingEventRow } from "@/features/billing/queries"
import { BillingModeBanner, ProviderBadge } from "@/features/billing/ui"

import { useAdminList } from "../queries"
import { AdminPageHeader } from "../ui/admin-shell"
import { DealershipChip } from "../ui/dealership-chip"

const helper = createColumnHelper<AppFeatures, BillingEventRow>()
const EMPTY: BillingEventRow[] = []

export function AdminBillingEventsView() {
  const url = useTableUrlState("receivedAt.desc", 25)
  const query = useAdminList<BillingEventRow>("billing/events", url.params)
  const overview = useRevenueOverview()

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("receivedAt", {
          header: "Received",
          enableSorting: false,
          cell: ({ getValue }) => (
            <span className="font-mono text-xs whitespace-nowrap tabular-nums">{format(parseISO(getValue()), "d MMM yyyy HH:mm:ss")}</span>
          ),
        }),
        helper.accessor("type", {
          header: "Event",
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue()}</span>,
        }),
        helper.accessor("dealershipCode", {
          header: "Dealership",
          enableSorting: false,
          cell: ({ getValue }) => (getValue() ? <DealershipChip code={getValue()!} /> : <span className="text-muted-foreground">—</span>),
        }),
        helper.accessor("summary", {
          header: "Result",
          enableSorting: false,
          cell: ({ row }) =>
            row.original.error ? (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="size-3.5 shrink-0" />
                <span className="line-clamp-1">{row.original.error}</span>
              </span>
            ) : row.original.processedAt ? (
              <span className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                <span className="line-clamp-1">{row.original.summary ?? "Processed"}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                Pending
              </span>
            ),
        }),
        helper.accessor("provider", {
          header: "Source",
          enableSorting: false,
          cell: ({ getValue }) => <ProviderBadge provider={getValue()} />,
        }),
        helper.accessor("id", {
          header: "Event id",
          enableSorting: false,
          cell: ({ getValue }) => <span className="max-w-44 truncate font-mono text-xs text-muted-foreground">{getValue()}</span>,
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
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Event log"
        description="Every Stripe webhook (and simulated sandbox event) the platform received, and what it did. Duplicate deliveries are processed once."
      />
      {overview.data && <BillingModeBanner mode={overview.data.mode} webhookConfigured={overview.data.webhookConfigured} />}
      <div className="flex flex-col gap-3">
        <DataTable
          table={table}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          empty={
            <DataTableEmpty
              error={query.error}
              onRetry={() => void query.refetch()}
              search=""
              onClearSearch={() => {}}
              searchHint=""
              icon={Webhook}
              title="No events yet"
              description="Events appear here as soon as Stripe (or the sandbox) reports something."
              addLabel="Refresh"
              onAdd={() => void query.refetch()}
            />
          }
        />
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
