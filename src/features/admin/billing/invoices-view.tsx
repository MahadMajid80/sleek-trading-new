"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { Ban, CreditCard, ExternalLink, FileText, MoreHorizontal, ReceiptText } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter, NumberRangeFilter } from "@/components/data-table/filters"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatMoney, invoiceStatusMeta } from "@/features/billing/meta"
import { useAdminInvoiceAction, type BillingInvoiceRow } from "@/features/billing/queries"
import { ConfirmActionDialog, InvoiceStatusBadge, ProviderBadge } from "@/features/billing/ui"
import { ApiError } from "@/lib/api-client"
import { formatKESCompact } from "@/lib/format"

import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { DealershipCell, muted } from "../views/cells"

const helper = createColumnHelper<AppFeatures, BillingInvoiceRow>()
const day = (value: string | null) => (value ? format(parseISO(value), "d MMM yyyy") : null)

export function AdminBillingInvoicesView() {
  const act = useAdminInvoiceAction()
  const [voiding, setVoiding] = useState<BillingInvoiceRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const pay = (invoice: BillingInvoiceRow) =>
    act.mutate(
      { id: invoice.id, action: "pay" },
      {
        onSuccess: (result) =>
          result.paid
            ? toast.success("Payment collected", { description: `${invoice.number} · ${formatMoney(invoice.amountRemaining, invoice.currency)}` })
            : toast.error("Payment failed", { description: result.message ?? "The card on file was declined." }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't charge this invoice"),
      },
    )

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: "Invoice",
          meta: { label: "Invoice" },
          enableHiding: false,
          enableSorting: false,
          cell: ({ row }) => (
            <span className="grid">
              <span className="font-mono font-medium whitespace-nowrap">{row.original.number ?? row.original.providerInvoiceId}</span>
              <span className="max-w-52 truncate text-xs text-muted-foreground">{row.original.description ?? "Subscription"}</span>
            </span>
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
          cell: ({ row }) => (
            <span className="grid justify-items-start gap-0.5">
              <InvoiceStatusBadge status={row.original.status} />
              {row.original.status === "open" && row.original.attemptCount > 0 && (
                <span className="text-xs text-destructive">
                  {row.original.attemptCount} failed attempt{row.original.attemptCount === 1 ? "" : "s"}
                </span>
              )}
            </span>
          ),
        }),
        helper.accessor("amountDue", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
          meta: { label: "Amount" },
          cell: ({ row }) => (
            <span className="grid">
              <span className="font-medium whitespace-nowrap tabular-nums">{formatMoney(row.original.amountDue, row.original.currency)}</span>
              {row.original.amountRemaining > 0 && row.original.status === "open" && (
                <span className="text-xs whitespace-nowrap text-destructive tabular-nums">
                  {formatMoney(row.original.amountRemaining, row.original.currency)} due
                </span>
              )}
            </span>
          ),
        }),
        helper.accessor("periodStart", {
          header: "Period",
          meta: { label: "Period" },
          enableSorting: false,
          cell: ({ row }) =>
            row.original.periodStart ? (
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {day(row.original.periodStart)} – {day(row.original.periodEnd)}
              </span>
            ) : (
              muted
            ),
        }),
        helper.accessor("issuedAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Issued" />,
          meta: { label: "Issued" },
          cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{day(getValue())}</span>,
        }),
        helper.accessor("paidAt", {
          header: "Paid",
          meta: { label: "Paid" },
          enableSorting: false,
          cell: ({ row }) =>
            row.original.paidAt ? (
              <span className="whitespace-nowrap text-muted-foreground">{day(row.original.paidAt)}</span>
            ) : row.original.nextPaymentAttempt && row.original.status === "open" ? (
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                Retry {formatDistanceToNowStrict(parseISO(row.original.nextPaymentAttempt), { addSuffix: true })}
              </span>
            ) : (
              muted
            ),
        }),
        helper.accessor("provider", {
          header: "Provider",
          meta: { label: "Provider" },
          enableSorting: false,
          cell: ({ getValue }) => <ProviderBadge provider={getValue()} />,
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => {
            const invoice = row.original
            const hasLinks = invoice.hostedInvoiceUrl || invoice.invoicePdfUrl
            if (invoice.status !== "open" && !hasLinks) return null
            return (
              <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invoice.number}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {invoice.status === "open" && (
                      <DropdownMenuItem onSelect={() => pay(invoice)}>
                        <CreditCard />
                        Charge card on file
                      </DropdownMenuItem>
                    )}
                    {invoice.hostedInvoiceUrl && (
                      <DropdownMenuItem asChild>
                        <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink />
                          Open in Stripe
                        </a>
                      </DropdownMenuItem>
                    )}
                    {invoice.invoicePdfUrl && (
                      <DropdownMenuItem asChild>
                        <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">
                          <FileText />
                          Download PDF
                        </a>
                      </DropdownMenuItem>
                    )}
                    {invoice.status === "open" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => (setVoiding(invoice), setConfirmOpen(true))}>
                          <Ban />
                          Void invoice
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        }),
      ]),
    // `pay` only closes over the stable mutation handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { url, filters, query, table } = useAdminTable<
    BillingInvoiceRow,
    { status: "multi"; from: "text"; to: "text"; minAmount: "number"; maxAmount: "number" }
  >({
    resource: "billing/invoices",
    defaultSort: "issuedAt.desc",
    spec: { status: "multi", from: "text", to: "text", minAmount: "number", maxAmount: "number" },
    columns,
    hidden: { provider: false },
  })

  return (
    <>
      <AdminListPage
        title="Billing invoices"
        description="subscription invoices issued to dealerships"
        count={query.data?.rowCount}
        search={url.params.q}
        onSearch={url.setSearch}
        searchPlaceholder="Search invoice number, dealership…"
        filters={
          <>
            <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
            <FacetedFilter
              title="Status"
              selected={filters.values.status}
              onChange={(v) => filters.set("status", v)}
              options={Object.entries(invoiceStatusMeta).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <DateRangeFilter
              title="Issued"
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
        emptyIcon={ReceiptText}
        emptyTitle="No billing invoices"
      />
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={Ban}
        destructive
        title={`Void ${voiding?.number ?? "invoice"}?`}
        description="The dealership will no longer owe this amount and no further payment attempts are made. Voided invoices can't be reopened."
        confirmLabel="Void invoice"
        onConfirm={() => {
          setConfirmOpen(false)
          if (!voiding) return
          act.mutate(
            { id: voiding.id, action: "void" },
            {
              onSuccess: () => toast.success("Invoice voided", { description: voiding.number ?? undefined }),
              onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't void this invoice"),
            },
          )
        }}
      />
    </>
  )
}
