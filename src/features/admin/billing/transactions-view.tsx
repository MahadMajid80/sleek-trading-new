"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { ArrowLeftRight, ExternalLink, MoreHorizontal, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter, NumberRangeFilter } from "@/components/data-table/filters"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatMoney, transactionStatusMeta } from "@/features/billing/meta"
import { useRefund, type BillingTransactionRow } from "@/features/billing/queries"
import { CardOnFile, ConfirmActionDialog, ProviderBadge, TransactionStatusBadge } from "@/features/billing/ui"
import { ApiError } from "@/lib/api-client"
import { formatKESCompact } from "@/lib/format"

import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { DealershipCell, muted } from "../views/cells"

const helper = createColumnHelper<AppFeatures, BillingTransactionRow>()

export function AdminTransactionsView() {
  const refund = useRefund()
  const [refunding, setRefunding] = useState<BillingTransactionRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("occurredAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
          meta: { label: "Date" },
          enableHiding: false,
          cell: ({ getValue }) => (
            <span className="grid whitespace-nowrap">
              <span className="tabular-nums">{format(parseISO(getValue()), "d MMM yyyy")}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{format(parseISO(getValue()), "HH:mm")}</span>
            </span>
          ),
        }),
        helper.accessor("dealershipCode", {
          header: "Dealership",
          meta: { label: "Dealership" },
          enableSorting: false,
          cell: ({ row }) => <DealershipCell code={row.original.dealershipCode} name={row.original.dealershipName} />,
        }),
        helper.accessor("amount", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
          meta: { label: "Amount" },
          cell: ({ row }) => {
            const t = row.original
            return (
              <span className="grid">
                <span
                  className={
                    t.status === "failed"
                      ? "font-medium whitespace-nowrap text-muted-foreground line-through tabular-nums"
                      : "font-semibold whitespace-nowrap tabular-nums"
                  }
                >
                  {formatMoney(t.amount, t.currency)}
                </span>
                {t.amountRefunded > 0 && (
                  <span className="text-xs whitespace-nowrap text-sky-600 tabular-nums dark:text-sky-300">
                    −{formatMoney(t.amountRefunded, t.currency)} refunded
                  </span>
                )}
              </span>
            )
          },
        }),
        helper.accessor("status", {
          header: "Status",
          meta: { label: "Status" },
          enableSorting: false,
          cell: ({ row }) => (
            <span className="grid justify-items-start gap-0.5">
              <TransactionStatusBadge status={row.original.status} />
              {row.original.failureMessage && <span className="max-w-48 truncate text-xs text-destructive">{row.original.failureMessage}</span>}
            </span>
          ),
        }),
        helper.accessor("cardLast4", {
          header: "Method",
          meta: { label: "Payment method" },
          enableSorting: false,
          cell: ({ row }) => <CardOnFile brand={row.original.cardBrand} last4={row.original.cardLast4} />,
        }),
        helper.accessor("invoiceNumber", {
          header: "Invoice",
          meta: { label: "Invoice" },
          enableSorting: false,
          cell: ({ getValue }) => (getValue() ? <span className="font-mono text-sm">{getValue()}</span> : muted),
        }),
        helper.accessor("fee", {
          header: "Fee",
          meta: { label: "Processing fee" },
          enableSorting: false,
          cell: ({ row }) =>
            row.original.fee !== null ? (
              <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatMoney(row.original.fee, row.original.currency)}</span>
            ) : (
              muted
            ),
        }),
        helper.accessor("providerTransactionId", {
          header: "Reference",
          meta: { label: "Provider reference" },
          enableSorting: false,
          cell: ({ row }) => (
            <span className="flex items-center gap-2">
              <ProviderBadge provider={row.original.provider} />
              <span className="max-w-36 truncate font-mono text-xs text-muted-foreground">{row.original.providerTransactionId}</span>
            </span>
          ),
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => {
            const t = row.original
            const refundable = t.status === "succeeded" || t.status === "partially_refunded"
            if (!refundable && !t.receiptUrl) return null
            return (
              <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Transaction actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {t.receiptUrl && (
                      <DropdownMenuItem asChild>
                        <a href={t.receiptUrl} target="_blank" rel="noreferrer">
                          <ExternalLink />
                          Stripe receipt
                        </a>
                      </DropdownMenuItem>
                    )}
                    {refundable && (
                      <DropdownMenuItem variant="destructive" onSelect={() => (setRefunding(t), setConfirmOpen(true))}>
                        <RotateCcw />
                        Refund
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        }),
      ]),
    [],
  )

  const { url, filters, query, table } = useAdminTable<
    BillingTransactionRow,
    { status: "multi"; from: "text"; to: "text"; minAmount: "number"; maxAmount: "number" }
  >({
    resource: "billing/transactions",
    defaultSort: "occurredAt.desc",
    spec: { status: "multi", from: "text", to: "text", minAmount: "number", maxAmount: "number" },
    columns,
    hidden: { fee: false },
  })

  return (
    <>
      <AdminListPage
        title="Transactions"
        description="every charge, decline and refund on dealership subscriptions"
        count={query.data?.rowCount}
        search={url.params.q}
        onSearch={url.setSearch}
        searchPlaceholder="Search dealership, invoice, card last 4, reference…"
        filters={
          <>
            <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
            <FacetedFilter
              title="Status"
              selected={filters.values.status}
              onChange={(v) => filters.set("status", v)}
              options={Object.entries(transactionStatusMeta).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <DateRangeFilter
              title="Date"
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
        emptyIcon={ArrowLeftRight}
        emptyTitle="No transactions"
      />
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={RotateCcw}
        destructive
        title="Refund this payment?"
        description={
          refunding
            ? `${formatMoney(refunding.amount - refunding.amountRefunded, refunding.currency)} goes back to ${refunding.dealershipName}'s card. The invoice stays paid.`
            : ""
        }
        confirmLabel="Refund"
        onConfirm={() => {
          setConfirmOpen(false)
          if (!refunding) return
          refund.mutate(refunding.id, {
            onSuccess: () => toast.success("Payment refunded", { description: refunding.dealershipName }),
            onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't refund this payment"),
          })
        }}
      />
    </>
  )
}
