"use client"

import { createColumnHelper, useTable } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { FileDown, FileText, MoreHorizontal, Pencil, Plus, Rocket, Trash2 } from "lucide-react"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { downloadInvoicePdf } from "@/features/documents/download"
import { ApiError } from "@/lib/api-client"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"
import { useDialogStore } from "@/stores/dialog-store"

import { fetchInvoiceDocument, useDeleteInvoice, useInvoices, usePublishProforma, type InvoiceRow } from "./queries"
import { formatInvoiceNumber, invoiceKindMeta, type InvoiceKind } from "./schema"

const helper = createColumnHelper<AppFeatures, InvoiceRow>()
const EMPTY: InvoiceRow[] = []
const STATUS_FILTERS = ["all", "draft", "live"] as const

export function InvoicesView({ kind }: { kind: InvoiceKind }) {
  const meta = invoiceKindMeta[kind]
  const url = useTableUrlState("number.desc")
  const filters = useTableFilters({ from: "text", to: "text", minPrice: "number", maxPrice: "number" })
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault("all").withOptions({ history: "replace", clearOnDefault: true }),
  )
  const query = useInvoices(kind, { ...url.params, ...filters.params, status: kind === "proforma" && status !== "all" ? status : "" })
  const remove = useDeleteInvoice(kind)
  const publish = usePublishProforma()
  const openDialog = useDialogStore((state) => state.open)
  const confirm = useConfirmState<InvoiceRow>()
  const publishConfirm = useConfirmState<InvoiceRow>()
  const [downloading, setDownloading] = useState<string | null>(null)
  const requestDelete = confirm.request
  const requestPublish = publishConfirm.request

  const download = useCallback(
    async (invoice: InvoiceRow) => {
      setDownloading(invoice.id)
      try {
        await downloadInvoicePdf(kind, await fetchInvoiceDocument(kind, invoice.id))
      } catch (error) {
        console.error(error)
        toast.error("Couldn't generate the PDF")
      } finally {
        setDownloading(null)
      }
    },
    [kind],
  )

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
          meta: { label: "Invoice" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="grid">
              <span className="font-mono text-[14px] font-semibold">{formatInvoiceNumber(kind, row.original.number)}</span>
              <span className="text-xs text-muted-foreground">{format(parseISO(row.original.createdAt), "d MMM yyyy")}</span>
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
              <span className="font-mono text-xs text-muted-foreground">{row.original.customerPhone}</span>
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
              <span className="font-mono text-xs text-muted-foreground">{row.original.carRegNo ?? "—"}</span>
            </div>
          ),
        }),
        helper.accessor("agreedPrice", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
          meta: { label: "Price", className: "text-right" },
          cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatKES(getValue())}</span>,
        }),
        helper.accessor("deposit", {
          header: "Deposit",
          meta: { label: "Deposit", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{formatKES(getValue())}</span>,
        }),
        helper.accessor("balance", {
          header: "Balance",
          meta: { label: "Balance", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="tabular-nums">{formatKES(getValue())}</span>,
        }),
        helper.accessor("status", {
          header: kind === "proforma" ? "Status" : "Source",
          meta: { label: kind === "proforma" ? "Status" : "Source" },
          enableSorting: false,
          cell: ({ row }) =>
            kind === "proforma" ? (
              row.original.status === "live" ? (
                <div className="grid gap-0.5">
                  <Badge variant="outline" className="border-success/25 bg-success/12 text-success">
                    Live
                  </Badge>
                  {row.original.linkedNumber && (
                    <span className="font-mono text-xs text-muted-foreground">→ {formatInvoiceNumber("final", row.original.linkedNumber)}</span>
                  )}
                </div>
              ) : (
                <Badge variant="outline">Draft</Badge>
              )
            ) : row.original.linkedNumber ? (
              <span className="font-mono text-xs text-muted-foreground">From {formatInvoiceNumber("proforma", row.original.linkedNumber)}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Direct</span>
            ),
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-20" },
          cell: ({ row }) => {
            const invoice = row.original
            const lockedProforma = kind === "proforma" && invoice.status === "live"
            return (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label="Download PDF"
                  disabled={downloading === invoice.id}
                  onClick={() => void download(invoice)}
                >
                  <FileDown />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Invoice actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuGroup>
                      {kind === "proforma" && invoice.status === "draft" && (
                        <DropdownMenuItem onSelect={() => requestPublish(invoice)}>
                          <Rocket />
                          Mark as live
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={lockedProforma}
                        onSelect={() => openDialog({ type: "invoice-form", kind, invoice })}
                      >
                        <Pencil />
                        {lockedProforma ? "Live — edit the final invoice" : "Edit"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void download(invoice)}>
                        <FileText />
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => requestDelete(invoice)}>
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        }),
      ]),
    [kind, downloading, download, openDialog, requestDelete, requestPublish],
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
    initialState: { columnVisibility: { deposit: false } },
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })

  const confirmDelete = () => {
    const invoice = confirm.item
    if (!invoice) return
    confirm.onOpenChange(false)
    remove.mutate(invoice.id, {
      onSuccess: () => toast.success(`${meta.singular} deleted`, { description: formatInvoiceNumber(kind, invoice.number) }),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete invoice"),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={meta.title}
        description={
          query.data
            ? `${formatNumber(query.data.rowCount)} ${url.params.q || status !== "all" || filters.active ? "matching" : "total"}`
            : kind === "proforma"
              ? "Quotes sent to customers before a sale"
              : "Invoices for completed sales"
        }
        actions={
          <Button size="lg" onClick={() => openDialog({ type: "invoice-form", kind })}>
            <Plus data-icon="inline-start" />
            New {kind === "proforma" ? "proforma" : "invoice"}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {kind === "proforma" && (
          <Tabs
            value={status}
            onValueChange={(value) => {
              void setStatus(value as (typeof STATUS_FILTERS)[number])
              url.onPaginationChange((p) => ({ ...p, pageIndex: 0 }))
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
              <TabsTrigger value="live">Live</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch value={url.params.q} onChange={url.setSearch} placeholder={`Search ${meta.prefix} number, customer, vehicle or reg…`} />
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
          <ResetFilters active={filters.active} onReset={filters.reset} />
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>
        <DataTable
          table={table}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          onRowClick={(invoice) =>
            !(kind === "proforma" && invoice.status === "live") && openDialog({ type: "invoice-form", kind, invoice })
          }
          empty={
            <DataTableEmpty
              error={query.error}
              onRetry={() => void query.refetch()}
              search={url.params.q || (filters.active ? "these filters" : "")}
              onClearSearch={() => {
                url.setSearch("")
                filters.reset()
              }}
              searchHint="Try an invoice number, customer name or registration."
              icon={FileText}
              title={`No ${meta.title.toLowerCase()} yet`}
              description={kind === "proforma" ? "Create a proforma to quote a customer." : "Final invoices are issued when a proforma goes live, or created directly."}
              addLabel={`New ${kind === "proforma" ? "proforma" : "invoice"}`}
              onAdd={() => openDialog({ type: "invoice-form", kind })}
            />
          }
        />
        <DataTablePagination table={table} />
      </div>

      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete ${confirm.item ? formatInvoiceNumber(kind, confirm.item.number) : "invoice"}?`}
        description={
          kind === "proforma"
            ? "The proforma is removed. If it's live, its final invoice is kept."
            : "The final invoice is permanently removed."
        }
        onConfirm={confirmDelete}
      />

      <AlertDialog open={publishConfirm.open} onOpenChange={publishConfirm.onOpenChange}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/12 text-accent-foreground">
              <Rocket />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Mark {publishConfirm.item && formatInvoiceNumber("proforma", publishConfirm.item.number)} as live?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This issues the final invoice with the same details. The proforma can&apos;t be edited afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const invoice = publishConfirm.item
                if (!invoice) return
                publish.mutate(invoice.id, {
                  onSuccess: (finalInvoice) =>
                    toast.success("Proforma is live", {
                      description: `Final invoice ${formatInvoiceNumber("final", finalInvoice.number)} issued`,
                    }),
                  onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't publish"),
                })
              }}
            >
              Mark as live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
