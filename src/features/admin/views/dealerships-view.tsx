"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { Building2, Eye, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { FacetedFilter } from "@/components/data-table/filters"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError } from "@/lib/api-client"
import { COUNTRY_OPTIONS, countryName } from "@/lib/countries"
import { formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useDeleteDealership, useUpdateDealership, type AdminDealership } from "../queries"
import { useAdminDialog } from "../ui/admin-dialogs"
import { AdminListPage, useAdminTable } from "../ui/admin-table"
import { DealershipLogo } from "../ui/dealership-logo"
import { Ago, DealershipStatusBadge, muted } from "./cells"

const helper = createColumnHelper<AppFeatures, AdminDealership>()

export function AdminDealershipsView() {
  const router = useRouter()
  const openDialog = useAdminDialog((state) => state.open)
  const update = useUpdateDealership()
  const remove = useDeleteDealership()
  const confirm = useConfirmState<AdminDealership>()
  const requestDelete = confirm.request
  const goTo = (id: string) => router.push(`/admin/dealerships/${id}` as Route)

  const toggleStatus = (d: AdminDealership) => {
    const status = d.status === "active" ? "suspended" : "active"
    update.mutate(
      { id: d.id, values: { name: d.name, country: d.country, city: d.city, phone: d.phone ?? "", email: d.email ?? "", status } },
      {
        onSuccess: () => toast.success(status === "active" ? "Dealership reactivated" : "Dealership suspended", { description: d.name }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update dealership"),
      },
    )
  }

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Dealership" />,
          meta: { label: "Dealership" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="flex min-w-52 items-center gap-3">
              <DealershipLogo dealership={row.original} className="size-9" />
              <div className="grid min-w-0">
                <span className="truncate font-semibold">{row.original.name}</span>
                <span className="truncate text-xs text-muted-foreground">{row.original.city}</span>
              </div>
            </div>
          ),
        }),
        helper.accessor("country", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
          meta: { label: "Country" },
          cell: ({ getValue }) => <span className="whitespace-nowrap">{countryName(getValue())}</span>,
        }),
        helper.accessor("phone", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
          meta: { label: "Phone" },
          cell: ({ getValue }) => (getValue() ? <span className="font-mono text-[14px] whitespace-nowrap">{getValue()}</span> : muted),
        }),
        helper.accessor("status", {
          header: "Status",
          meta: { label: "Status" },
          enableSorting: false,
          cell: ({ getValue }) => <DealershipStatusBadge status={getValue()} />,
        }),
        helper.accessor("customers", {
          header: "Customers",
          meta: { label: "Customers", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue())}</span>,
        }),
        helper.accessor("carsInStock", {
          header: "Vehicles",
          meta: { label: "Vehicles (available / total)", className: "text-right" },
          enableSorting: false,
          cell: ({ row }) => (
            <span className="tabular-nums">
              {formatNumber(row.original.carsInStock)}
              <span className="text-muted-foreground">/{formatNumber(row.original.cars)}</span>
            </span>
          ),
        }),
        helper.accessor("agreements", {
          header: "Agreements",
          meta: { label: "Agreements", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue())}</span>,
        }),
        helper.accessor("collectedThisMonth", {
          header: "This month",
          meta: { label: "Collected this month", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatKESCompact(getValue())}</span>,
        }),
        helper.accessor("outstanding", {
          header: "Outstanding",
          meta: { label: "Outstanding", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="tabular-nums">{formatKESCompact(getValue())}</span>,
        }),
        helper.accessor("overdue", {
          header: "Overdue",
          meta: { label: "Overdue", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => (
            <span className={cn("font-medium tabular-nums", getValue() > 0 && "text-destructive")}>{formatKESCompact(getValue())}</span>
          ),
        }),
        helper.accessor("email", {
          header: "Email",
          meta: { label: "Email" },
          enableSorting: false,
          cell: ({ getValue }) => getValue() ?? muted,
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Opened" />,
          meta: { label: "Opened" },
          cell: ({ getValue }) => <Ago value={getValue()} />,
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => (
            <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => goTo(row.original.id)}>
                    <Eye />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openDialog({ type: "dealership", dealership: row.original })}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggleStatus(row.original)}>
                    {row.original.status === "active" ? <Pause /> : <Play />}
                    {row.original.status === "active" ? "Suspend" : "Reactivate"}
                  </DropdownMenuItem>
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
    // goTo/toggleStatus only close over stable handles (router, mutation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openDialog, requestDelete],
  )

  const { url, filters, query, table } = useAdminTable<AdminDealership, { status: "multi"; country: "multi" }>({
    resource: "dealerships",
    defaultSort: "createdAt.desc",
    spec: { status: "multi", country: "multi" },
    columns,
    hidden: { email: false, outstanding: false, agreements: false },
  })

  const confirmDelete = () => {
    const d = confirm.item
    if (!d) return
    confirm.onOpenChange(false)
    remove.mutate(d.id, {
      onSuccess: () => toast.success("Dealership deleted", { description: d.name }),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete dealership"),
    })
  }

  return (
    <>
      <AdminListPage
        title="Dealerships"
        description="every dealership on the platform"
        count={query.data?.rowCount}
        actions={
          <Button size="lg" onClick={() => openDialog({ type: "dealership" })}>
            <Plus data-icon="inline-start" />
            New dealership
          </Button>
        }
        search={url.params.q}
        onSearch={url.setSearch}
        searchPlaceholder="Search name, city, phone, email…"
        filters={
          <>
            <FacetedFilter
              title="Status"
              selected={filters.values.status}
              onChange={(values) => filters.set("status", values)}
              options={[
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
            <FacetedFilter
              title="Country"
              selected={filters.values.country}
              onChange={(values) => filters.set("country", values)}
              options={COUNTRY_OPTIONS}
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
        onRowClick={(dealership) => goTo(dealership.id)}
        emptyIcon={Building2}
        emptyTitle="No dealerships"
      />
      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete ${confirm.item?.name ?? "dealership"}?`}
        description="Only dealerships with no customers, vehicles or agreements can be deleted, and their admins are removed with them. Suspend a dealership instead to lock it out and keep its records."
        onConfirm={confirmDelete}
      />
    </>
  )
}
