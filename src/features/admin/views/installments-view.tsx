"use client"

import { useQuery } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { AlertTriangle, CalendarClock, CalendarRange, TrendingUp, Wallet } from "lucide-react"
import { useMemo } from "react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { amountDue, remainingAmount, statusMeta, todayISO, type InstallmentStatus } from "@/features/installments/ledger"
import { apiFetch } from "@/lib/api-client"
import { formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useAdminDialog } from "../ui/admin-dialogs"
import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { Day, DealershipCell, Money, StatTiles, TONES } from "./cells"

type Row = {
  id: string
  agreementId: string
  agreementNumber: number
  dealershipCode: string
  dealershipName: string
  sequence: number
  totalInstallments: number
  dueDate: string
  amount: number
  paid: number
  carriedOver: number
  carriedForward: number
  customerName: string | null
  customerPhone: string | null
  carTitle: string
  carRegNo: string | null
  status: InstallmentStatus
}

type Summary = {
  overdueAmount: number
  overdueCount: number
  dueSoonAmount: number
  dueSoonCount: number
  outstanding: number
  collectedThisMonth: number
  paymentsThisMonth: number
}

const FILTERS = [
  ["overdue", "Overdue"],
  ["due-soon", "Due in 7 days"],
  ["open", "Open"],
  ["settled", "Settled"],
  ["all", "All"],
] as const

const helper = createColumnHelper<AppFeatures, Row>()

export function AdminInstallmentsView() {
  const openDialog = useAdminDialog((state) => state.open)
  const summary = useQuery({
    queryKey: ["admin", "installments-summary"],
    queryFn: ({ signal }) => apiFetch<Summary>("/api/admin/installments/summary", { signal }),
  })
  const today = todayISO()

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("dueDate", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
          meta: { label: "Due date" },
          enableHiding: false,
          cell: ({ row }) => {
            const days = differenceInCalendarDays(parseISO(row.original.dueDate), parseISO(today))
            const open = row.original.status !== "paid" && row.original.status !== "carried"
            return (
              <div className="grid">
                <Day value={row.original.dueDate} />
                {open && (
                  <span className={cn("text-xs", days < 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {days < 0 ? `${-days}d late` : days === 0 ? "Today" : `in ${days}d`}
                  </span>
                )}
              </div>
            )
          },
        }),
        helper.accessor("agreementNumber", {
          id: "number",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
          meta: { label: "Agreement" },
          cell: ({ row }) => (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-mono font-medium">{formatAgreementNumber(row.original.agreementNumber, row.original.dealershipCode)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                #{row.original.sequence}/{row.original.totalInstallments}
              </span>
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
              <span className="truncate font-medium">{row.original.customerName ?? "—"}</span>
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
              <span className="font-mono text-xs text-muted-foreground">{row.original.carRegNo}</span>
            </div>
          ),
        }),
        helper.accessor("amount", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
          meta: { label: "Amount due" },
          cell: ({ row }) => <Money value={amountDue(row.original)} />,
        }),
        helper.accessor((row) => remainingAmount(row), {
          id: "remaining",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Remaining" />,
          meta: { label: "Remaining" },
          cell: ({ getValue }) => (getValue() > 0 ? <Money value={getValue()} /> : <span className="text-muted-foreground">—</span>),
        }),
        helper.accessor("status", {
          header: "Status",
          meta: { label: "Status" },
          enableSorting: false,
          cell: ({ getValue }) => (
            <Badge variant="outline" className={statusMeta[getValue()].className}>
              {statusMeta[getValue()].label}
            </Badge>
          ),
        }),
      ]),
    [today],
  )

  const { url, filters, query, table } = useAdminTable<Row, { filter: "text" }>({
    resource: "installments",
    defaultSort: "dueDate.asc",
    spec: { filter: "text" },
    columns,
  })
  const filter = filters.values.filter || "open"
  const s = summary.data

  return (
    <AdminListPage
      title="Installments"
      description="hire purchase schedules across the platform"
      count={query.data?.rowCount}
      summary={
        <div className="grid gap-4">
          <StatTiles
            items={[
              {
                label: "Overdue",
                value: s && formatKESCompact(s.overdueAmount),
                hint: s && `${formatNumber(s.overdueCount)} installments`,
                icon: AlertTriangle,
                tone: TONES.rose,
                active: filter === "overdue",
                onClick: () => filters.set("filter", "overdue"),
              },
              {
                label: "Due in 7 days",
                value: s && formatKESCompact(s.dueSoonAmount),
                hint: s && `${formatNumber(s.dueSoonCount)} installments`,
                icon: CalendarRange,
                tone: TONES.amber,
                active: filter === "due-soon",
                onClick: () => filters.set("filter", "due-soon"),
              },
              {
                label: "Outstanding",
                value: s && formatKESCompact(s.outstanding),
                hint: "All open installments",
                icon: TrendingUp,
                tone: TONES.gold,
                active: filter === "open",
                onClick: () => filters.set("filter", null),
              },
              {
                label: "Collected this month",
                value: s && formatKESCompact(s.collectedThisMonth),
                hint: s && `${formatNumber(s.paymentsThisMonth)} payments`,
                icon: Wallet,
                tone: TONES.mono,
              },
            ]}
          />
          <Tabs value={filter} onValueChange={(value) => filters.set("filter", value === "open" ? null : value)}>
            <TabsList className="max-w-full overflow-x-auto">
              {FILTERS.map(([value, label]) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      }
      search={url.params.q}
      onSearch={url.setSearch}
      searchPlaceholder="Search agreement, customer, phone, reg no…"
      filters={<DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />}
      activeFilters={filters.values.dealership.length ? 1 : 0}
      onResetFilters={() => filters.set("dealership", null)}
      table={table}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      onRowClick={(row) => openDialog({ type: "agreement", id: row.agreementId })}
      emptyIcon={CalendarClock}
      emptyTitle={filter === "overdue" ? "Nothing overdue" : "No installments here"}
    />
  )
}
