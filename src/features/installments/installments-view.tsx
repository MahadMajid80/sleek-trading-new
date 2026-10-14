"use client"

import { useQuery } from "@tanstack/react-query"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { AlertTriangle, CalendarClock, CalendarRange, Phone, TrendingUp, Wallet, type LucideIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useMemo } from "react"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableSearch } from "@/components/data-table/data-table-search"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { appTableFeatures, type AppFeatures } from "@/components/data-table/features"
import { useTableUrlState } from "@/components/data-table/use-table-url-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatAgreementNumber } from "@/features/agreements/schema"
import { apiFetch, toSearchParams, type Paginated } from "@/lib/api-client"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { amountDue, remainingAmount, statusMeta, todayISO, type InstallmentStatus } from "./ledger"

const FILTERS = ["overdue", "due-soon", "open", "settled", "all"] as const
const filterLabels: Record<(typeof FILTERS)[number], string> = {
  overdue: "Overdue",
  "due-soon": "Due this week",
  open: "All open",
  settled: "Settled",
  all: "Everything",
}

type InstallmentRow = {
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

const helper = createColumnHelper<AppFeatures, InstallmentRow>()
const EMPTY: InstallmentRow[] = []

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
  active,
}: {
  icon: LucideIcon
  label: string
  value?: string
  hint?: string
  tone?: "danger" | "warning" | "success"
  onClick?: () => void
  active?: boolean
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-4 transition-all",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        active && "ring-2 ring-primary/40",
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {value === undefined ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <span
              className={cn(
                "text-2xl font-semibold tracking-tight tabular-nums",
                tone === "danger" && "text-destructive",
                tone === "warning" && "text-warning",
                tone === "success" && "text-success",
              )}
            >
              {value}
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg bg-primary/12 text-accent-foreground",
            tone === "danger" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function dueLabel(row: InstallmentRow, today: string) {
  if (remainingAmount(row) === 0) return null
  const days = differenceInCalendarDays(parseISO(row.dueDate), parseISO(today))
  if (days < 0) return <span className="text-destructive">{-days} day{days === -1 ? "" : "s"} late</span>
  if (days === 0) return <span className="text-warning">Due today</span>
  if (days <= 7) return <span className="text-warning">In {days} day{days === 1 ? "" : "s"}</span>
  return null
}

export function InstallmentsView() {
  const router = useRouter()
  const url = useTableUrlState("dueDate.asc", 50)
  const [filter, setFilter] = useQueryState(
    "filter",
    parseAsStringLiteral(FILTERS).withDefault("open").withOptions({ history: "replace", clearOnDefault: true }),
  )
  const today = todayISO()

  const query = useQuery({
    queryKey: ["installments", "list", url.params, filter],
    queryFn: ({ signal }) =>
      apiFetch<Paginated<InstallmentRow>>(`/api/installments?${toSearchParams({ ...url.params, filter })}`, { signal }),
    placeholderData: (previous) => previous,
  })
  const summary = useQuery({
    queryKey: ["installments", "summary"],
    queryFn: ({ signal }) => apiFetch<Summary>("/api/installments/summary", { signal }),
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("dueDate", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
          meta: { label: "Due date" },
          enableHiding: false,
          cell: ({ row }) => (
            <div className="grid whitespace-nowrap">
              <span className="font-medium">{format(parseISO(row.original.dueDate), "d MMM yyyy")}</span>
              <span className="text-xs">{dueLabel(row.original, today)}</span>
            </div>
          ),
        }),
        helper.accessor("agreementNumber", {
          id: "number",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Agreement" />,
          meta: { label: "Agreement" },
          cell: ({ row }) => (
            <div className="grid">
              <Link
                href={`/agreements/${row.original.agreementId}` as Route}
                onClick={(event) => event.stopPropagation()}
                className="font-mono text-[14px] font-semibold underline-offset-4 hover:underline"
              >
                {formatAgreementNumber(row.original.agreementNumber, row.original.dealershipCode)}
              </Link>
              <span className="text-xs text-muted-foreground tabular-nums">
                {row.original.sequence} of {row.original.totalInstallments}
              </span>
            </div>
          ),
        }),
        helper.accessor("customerName", {
          header: "Customer",
          meta: { label: "Customer" },
          enableSorting: false,
          cell: ({ row }) => (
            <div className="grid min-w-36">
              <span className="truncate font-medium">{row.original.customerName ?? "—"}</span>
              {row.original.customerPhone && (
                <a
                  href={`tel:${row.original.customerPhone}`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  <Phone className="size-3" />
                  {row.original.customerPhone}
                </a>
              )}
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
        helper.accessor("amount", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Amount due" />,
          meta: { label: "Amount due", className: "text-right" },
          cell: ({ row }) => <span className="tabular-nums">{formatKES(amountDue(row.original))}</span>,
        }),
        helper.accessor("paid", {
          header: "Paid",
          meta: { label: "Paid", className: "text-right" },
          enableSorting: false,
          cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue() ? formatKES(getValue()) : "—"}</span>,
        }),
        helper.accessor((row) => remainingAmount(row), {
          id: "remaining",
          header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
          meta: { label: "Balance", className: "text-right" },
          cell: ({ getValue }) => <span className="font-semibold tabular-nums">{getValue() ? formatKES(getValue()) : "—"}</span>,
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
        helper.display({
          id: "actions",
          meta: { className: "w-28 text-right" },
          cell: ({ row }) =>
            remainingAmount(row.original) > 0 ? (
              <Button variant="outline" size="sm" asChild onClick={(event) => event.stopPropagation()}>
                <Link href={`/agreements/${row.original.agreementId}?pay=${row.original.id}` as Route}>
                  <Wallet data-icon="inline-start" />
                  Record
                </Link>
              </Button>
            ) : null,
        }),
      ]),
    [today],
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

  const s = summary.data
  const pickFilter = (value: (typeof FILTERS)[number]) => {
    void setFilter(value)
    url.onPaginationChange((p) => ({ ...p, pageIndex: 0 }))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Installments" description="Every hire purchase installment. Start with what's overdue." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={AlertTriangle}
          label="Overdue"
          value={s && formatKESCompact(s.overdueAmount)}
          hint={s && `${formatNumber(s.overdueCount)} installments`}
          tone={s?.overdueCount ? "danger" : undefined}
          onClick={() => pickFilter("overdue")}
          active={filter === "overdue"}
        />
        <SummaryCard
          icon={CalendarRange}
          label="Due in the next 7 days"
          value={s && formatKESCompact(s.dueSoonAmount)}
          hint={s && `${formatNumber(s.dueSoonCount)} installments`}
          tone={s?.dueSoonCount ? "warning" : undefined}
          onClick={() => pickFilter("due-soon")}
          active={filter === "due-soon"}
        />
        <SummaryCard
          icon={CalendarClock}
          label="Total outstanding"
          value={s && formatKESCompact(s.outstanding)}
          hint="Across all agreements"
          onClick={() => pickFilter("open")}
          active={filter === "open"}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Collected this month"
          value={s && formatKESCompact(s.collectedThisMonth)}
          hint={s && `${formatNumber(s.paymentsThisMonth)} payments`}
          tone="success"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Tabs value={filter} onValueChange={(value) => pickFilter(value as (typeof FILTERS)[number])}>
          <TabsList className="max-w-full overflow-x-auto">
            {FILTERS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {filterLabels[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center justify-between gap-2">
          <DataTableSearch value={url.params.q} onChange={url.setSearch} placeholder="Search SLK number, customer, phone or reg…" />
          <DataTableViewOptions table={table} />
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
              search={url.params.q}
              onClearSearch={() => url.setSearch("")}
              searchHint="Try an agreement number, a customer name or phone number."
              icon={CalendarClock}
              title={filter === "overdue" ? "Nothing overdue" : filter === "due-soon" ? "Nothing due this week" : "No installments here"}
              description={
                filter === "overdue"
                  ? "Every installment that has fallen due is paid."
                  : "Installments appear when a hire purchase agreement is created."
              }
              addLabel="New hire purchase agreement"
              onAdd={() => router.push("/agreements/new?type=hire_purchase" as Route)}
            />
          }
        />
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
