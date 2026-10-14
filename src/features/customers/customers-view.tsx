"use client"

import { createColumnHelper, useTable } from "@tanstack/react-table"
import { formatDistanceToNowStrict } from "date-fns"
import { UserPlus, Users } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableSearch } from "@/components/data-table/data-table-search"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { appTableFeatures, type AppFeatures } from "@/components/data-table/features"
import { DateRangeFilter, FacetedFilter, ResetFilters, useTableFilters } from "@/components/data-table/filters"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { PageHeader } from "@/components/page-header"
import { RowActions } from "@/components/row-actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api-client"
import { formatNumber, initials } from "@/lib/format"
import { useDialogStore } from "@/stores/dialog-store"

import { customersResource } from "./queries"
import type { CustomerRow } from "./schema"

const helper = createColumnHelper<AppFeatures, CustomerRow>()
const EMPTY: CustomerRow[] = []

export function CustomersView() {
  const url = useTableUrlState("createdAt.desc")
  const filters = useTableFilters({ deals: "multi", from: "text", to: "text" })
  const query = customersResource.useList({ ...url.params, ...filters.params })
  const remove = customersResource.useDelete()
  const openDialog = useDialogStore((state) => state.open)
  const confirm = useConfirmState<CustomerRow>()
  const requestDelete = confirm.request

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
          meta: { label: "Customer" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="flex min-w-52 items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-accent-foreground">
                  {initials(row.original.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0">
                <span className="truncate font-medium">{row.original.name}</span>
                <span className="truncate text-xs text-muted-foreground">{row.original.email ?? "No email"}</span>
              </div>
            </div>
          ),
        }),
        helper.accessor("nationalId", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="National ID" />,
          meta: { label: "National ID" },
          cell: ({ getValue }) => <span className="font-mono text-[14px] tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("telephone", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
          meta: { label: "Phone" },
          cell: ({ getValue }) => <span className="font-mono text-[14px] tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("kraPin", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="KRA PIN" />,
          meta: { label: "KRA PIN" },
          cell: ({ getValue }) => <span className="font-mono text-[14px]">{getValue()}</span>,
        }),
        helper.accessor("poBox", {
          header: "P.O. Box",
          meta: { label: "P.O. Box" },
          enableSorting: false,
          cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
          meta: { label: "Added" },
          cell: ({ getValue }) => (
            <time dateTime={getValue()} className="text-muted-foreground" title={new Date(getValue()).toLocaleString()}>
              {formatDistanceToNowStrict(new Date(getValue()), { addSuffix: true })}
            </time>
          ),
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => (
            <RowActions
              label={row.original.name}
              onEdit={() => openDialog({ type: "customer-form", customer: row.original })}
              onDelete={() => requestDelete(row.original)}
              copy={{ label: "Phone number", value: row.original.telephone }}
            />
          ),
        }),
      ]),
    [openDialog, requestDelete],
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
    initialState: { columnVisibility: { poBox: false } },
    state: { sorting: url.sorting, pagination: url.pagination },
    onSortingChange: url.onSortingChange,
    onPaginationChange: url.onPaginationChange,
  })

  const confirmDelete = () => {
    const customer = confirm.item
    if (!customer) return
    confirm.onOpenChange(false)
    remove.mutate(customer.id, {
      onSuccess: () => toast.success("Customer deleted", { description: customer.name }),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete customer"),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description={
          query.data
            ? `${formatNumber(query.data.rowCount)} ${url.params.q || filters.active ? "matching" : "total"} · buyers, sellers, witnesses and next of kin`
            : "Buyers, sellers, witnesses and next of kin"
        }
        actions={
          <Button size="lg" onClick={() => openDialog({ type: "customer-form" })}>
            <UserPlus data-icon="inline-start" />
            Add customer
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DataTableSearch
            value={url.params.q}
            onChange={url.setSearch}
            placeholder="Search name, phone, ID or KRA PIN…"
          />
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
          <ResetFilters active={filters.active} onReset={filters.reset} />
          <div className="ml-auto">
            <DataTableViewOptions table={table} />
          </div>
        </div>

        <DataTable
          table={table}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          onRowClick={(customer) => openDialog({ type: "customer-form", customer })}
          empty={
            <DataTableEmpty
              error={query.error}
              onRetry={() => void query.refetch()}
              search={url.params.q || (filters.active ? "these filters" : "")}
              onClearSearch={() => {
                url.setSearch("")
                filters.reset()
              }}
              searchHint="Try a different name, phone number, ID or KRA PIN."
              icon={Users}
              title="No customers yet"
              description="Add your first customer to start creating agreements and invoices."
              addLabel="Add customer"
              onAdd={() => openDialog({ type: "customer-form" })}
            />
          }
        />

        <DataTablePagination table={table} />
      </div>

      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete ${confirm.item?.name ?? "customer"}?`}
        description="This permanently removes the customer. Customers linked to agreements or invoices can't be deleted."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
