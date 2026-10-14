"use client"

import { createColumnHelper, useTable } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { ChevronDown, Eye, FilePen, Pencil, Plus, Trash2 } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableSearch } from "@/components/data-table/data-table-search"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { appTableFeatures, type AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter, NumberRangeFilter, ResetFilters, useTableFilters } from "@/components/data-table/filters"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError } from "@/lib/api-client"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { agreementTypeParam, useAgreements, useDeleteAgreement, type AgreementRow } from "./queries"
import { AGREEMENT_TYPES, agreementTypeMeta, formatAgreementNumber, typeBadgeClass } from "./schema"

const helper = createColumnHelper<AppFeatures, AgreementRow>()
const EMPTY: AgreementRow[] = []

export function HpProgress({ row }: { row: AgreementRow }) {
  if (row.type !== "hire_purchase" || !row.installmentCount) {
    return <span className="text-sm text-muted-foreground">{row.balance > 0 ? `${formatKES(row.balance)} balance` : "Settled at signing"}</span>
  }
  const settled = row.settledCount ?? 0
  const done = settled === row.installmentCount
  return (
    <div className="grid min-w-40 gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">
          {settled}/{row.installmentCount} paid
        </span>
        {done ? (
          <span className="font-medium text-success">Completed</span>
        ) : row.overdueCount ? (
          <span className="font-medium text-destructive">{row.overdueCount} overdue</span>
        ) : (
          <span className="text-muted-foreground">On track</span>
        )}
      </div>
      <Progress
        value={(settled / row.installmentCount) * 100}
        className={cn("h-1.5", row.overdueCount && !done && "[&_[data-slot=progress-indicator]]:bg-destructive")}
      />
    </div>
  )
}

export function NewAgreementMenu({ size = "lg" }: { size?: "lg" | "default" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size}>
          <Plus data-icon="inline-start" />
          New agreement
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Agreement type</DropdownMenuLabel>
          {AGREEMENT_TYPES.map((type) => (
            <DropdownMenuItem key={type} asChild>
              <Link href={`/agreements/new?type=${type}` as Route} className="flex-col items-start gap-0">
                <span className="font-medium">{agreementTypeMeta[type].short}</span>
                <span className="text-xs text-muted-foreground">{agreementTypeMeta[type].description}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AgreementsView() {
  const router = useRouter()
  const url = useTableUrlState("number.desc")
  const filters = useTableFilters({ status: "multi", from: "text", to: "text", minPrice: "number", maxPrice: "number" })
  const [typeFilter, setTypeFilter] = useQueryState("type", parseAsString.withDefault("").withOptions({ history: "replace" }))
  const type = agreementTypeParam(typeFilter)
  const query = useAgreements({ ...url.params, ...filters.params, type })
  const remove = useDeleteAgreement()
  const confirm = useConfirmState<AgreementRow>()
  const requestDelete = confirm.request

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
          meta: { label: "Agreement" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="grid">
              <span className="font-mono text-[14px] font-semibold">{formatAgreementNumber(row.original.number, row.original.dealershipCode)}</span>
              <span className="text-xs text-muted-foreground">{format(parseISO(row.original.createdAt), "d MMM yyyy")}</span>
            </div>
          ),
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
              <span className="truncate font-medium">{row.original.buyerName ?? row.original.sellerName ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{row.original.buyerName ? "Buyer" : "Seller"}</span>
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
              <span className="font-mono text-xs text-muted-foreground">{row.original.carRegNo ?? "No reg"}</span>
            </div>
          ),
        }),
        helper.accessor("agreedPrice", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
          meta: { label: "Price", className: "text-right" },
          cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatKES(getValue())}</span>,
        }),
        helper.accessor("outstanding", {
          header: "Progress",
          meta: { label: "Progress" },
          enableSorting: false,
          cell: ({ row }) => <HpProgress row={row.original} />,
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => (
            <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Agreement actions">
                    <FilePen />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href={`/agreements/${row.original.id}` as Route}>
                        <Eye />
                        Open
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/agreements/${row.original.id}/edit` as Route}>
                        <Pencil />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => requestDelete(row.original)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        }),
      ]),
    [requestDelete],
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
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })

  const confirmDelete = () => {
    const agreement = confirm.item
    if (!agreement) return
    confirm.onOpenChange(false)
    remove.mutate(agreement.id, {
      onSuccess: () => toast.success("Agreement deleted", { description: formatAgreementNumber(agreement.number, agreement.dealershipCode) }),
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.status === 409
            ? "This agreement has payments recorded, so it can't be deleted."
            : "Couldn't delete agreement",
        ),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agreements"
        description={
          query.data ? `${formatNumber(query.data.rowCount)} ${url.params.q || type || filters.active ? "matching" : "total"}` : "Cash sale, hire purchase and buying agreements"
        }
        actions={<NewAgreementMenu />}
      />

      <div className="flex flex-col gap-3">
        <Tabs
          value={type || "all"}
          onValueChange={(value) => {
            void setTypeFilter(value === "all" ? null : value)
            url.onPaginationChange((p) => ({ ...p, pageIndex: 0 }))
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {AGREEMENT_TYPES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {agreementTypeMeta[value].short}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch value={url.params.q} onChange={url.setSearch} placeholder="Search SLK number, customer, vehicle or reg…" />
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
          <ResetFilters active={filters.active} onReset={filters.reset} />
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>

        <DataTable
          table={table}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          onRowClick={(agreement) => router.push(`/agreements/${agreement.id}` as Route)}
          empty={
            <DataTableEmpty
              error={query.error}
              onRetry={() => void query.refetch()}
              search={url.params.q || (filters.active ? "these filters" : "")}
              onClearSearch={() => {
                url.setSearch("")
                filters.reset()
              }}
              searchHint="Try an agreement number like SLK-1004, a name or a registration number."
              icon={FilePen}
              title={type ? `No ${agreementTypeMeta[type].short.toLowerCase()} agreements yet` : "No agreements yet"}
              description="Create an agreement to generate the paperwork and, for hire purchase, the installment schedule."
              addLabel="New agreement"
              onAdd={() => router.push(`/agreements/new?type=${type || "hire_purchase"}` as Route)}
            />
          }
        />

        <DataTablePagination table={table} />
      </div>

      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete ${confirm.item ? formatAgreementNumber(confirm.item.number, confirm.item.dealershipCode) : "agreement"}?`}
        description="This removes the agreement, its schedule and documents. Agreements with recorded payments can't be deleted."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
