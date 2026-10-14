"use client"

import { differenceInCalendarDays, parseISO } from "date-fns"
import { AlertTriangle, Building2, CarFront, FilePen, Plus, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { agreementTypeMeta, formatAgreementNumber } from "@/features/agreements/schema"
import { todayISO } from "@/features/installments/ledger"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useAdminOverview } from "./queries"
import { AdminPageHeader } from "./ui/admin-shell"
import { useAdminDialog } from "./ui/admin-dialogs"
import { DealershipChip, dealershipChartColor } from "./ui/dealership-chip"
import { TONES } from "./views/cells"

const MIX_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)"]

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  gradient,
}: {
  icon: LucideIcon
  label: string
  value?: string
  hint?: string
  tone?: "danger"
  gradient: string
}) {
  return (
    <Card className="group relative overflow-hidden border-white/10 py-5 transition-all hover:-translate-y-0.5 hover:shadow-xl">
      <div aria-hidden className={cn("pointer-events-none absolute -top-16 -right-10 size-40 rounded-full opacity-25 blur-2xl", gradient)} />
      <CardContent className="relative grid gap-2 px-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className={cn("flex size-9 items-center justify-center rounded-xl shadow-lg", gradient)}>
            <Icon className="size-4" />
          </span>
        </div>
        {value === undefined ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <span className={cn("font-heading text-3xl font-semibold tracking-tight tabular-nums", tone === "danger" && "text-destructive")}>
            {value}
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}

export function AdminOverviewView() {
  const { data } = useAdminOverview()
  const openDialog = useAdminDialog((state) => state.open)
  const t = data?.totals
  const today = todayISO()

  const trendConfig: ChartConfig = Object.fromEntries(
    (data?.dealerships ?? []).map((d) => [d.code, { label: d.name, color: dealershipChartColor(d.code) }]),
  )
  const mixConfig: ChartConfig = Object.fromEntries(
    (data?.mix ?? []).map((m, index) => [m.type, { label: agreementTypeMeta[m.type].short, color: MIX_COLORS[index % 3] }]),
  )
  const maxCollected = Math.max(1, ...(data?.dealerships ?? []).map((d) => d.collectedThisMonth))

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Command center"
        description="Every dealership, customer, vehicle and shilling on the platform, live."
        actions={
          <Button size="lg" onClick={() => openDialog({ type: "dealership" })}>
            <Plus data-icon="inline-start" />
            New dealership
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Wallet}
          label="Collected this month"
          value={t && formatKESCompact(t.collectedThisMonth)}
          hint={t && `${formatKESCompact(t.outstanding)} outstanding platform-wide`}
          gradient={TONES.gold}
        />
        <Kpi
          icon={AlertTriangle}
          label="Overdue"
          value={t && formatKESCompact(t.overdue)}
          hint={t && `${formatNumber(t.activeHp)} active hire purchase agreements`}
          tone={t && t.overdue > 0 ? "danger" : undefined}
          gradient={TONES.rose}
        />
        <Kpi
          icon={Users}
          label="Customers"
          value={t && formatNumber(t.customers)}
          hint={t && `+${formatNumber(t.customersThisMonth)} this month`}
          gradient={TONES.navy}
        />
        <Kpi
          icon={Building2}
          label="Dealerships"
          value={t && `${t.activeDealerships}/${t.dealerships}`}
          hint={t && `${formatNumber(t.carsInStock)} of ${formatNumber(t.cars)} vehicles available · ${formatNumber(t.agreements)} agreements`}
          gradient={TONES.mono}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-accent-foreground" />
              Collections by dealership
            </CardTitle>
            <CardDescription>Installment payments received, last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ChartContainer config={trendConfig} className="aspect-auto h-72 w-full">
                <BarChart data={data.trend} margin={{ left: 4, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) => formatKESCompact(value).replace("Ksh", "").trim()}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={<ChartTooltipContent formatter={(value, name) => `${trendConfig[name as string]?.label}: ${formatKES(Number(value))}`} />}
                  />
                  {data.dealerships.map((d, index) => (
                    <Bar
                      key={d.code}
                      dataKey={d.code}
                      stackId="collections"
                      fill={`var(--color-${d.code})`}
                      radius={index === data.dealerships.length - 1 ? [6, 6, 0, 0] : 0}
                      maxBarSize={48}
                    />
                  ))}
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Skeleton className="h-72" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilePen className="size-4 text-accent-foreground" />
              Deal mix
            </CardTitle>
            <CardDescription>Agreements by type, all dealerships</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data ? (
              <>
                <ChartContainer config={mixConfig} className="mx-auto aspect-square h-48">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="type" />} />
                    <Pie data={data.mix} dataKey="count" nameKey="type" innerRadius={52} outerRadius={80} strokeWidth={3} stroke="var(--card)">
                      {data.mix.map((m, index) => (
                        <Cell key={m.type} fill={MIX_COLORS[index % 3]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="grid gap-2 text-sm">
                  {data.mix.map((m, index) => (
                    <li key={m.type} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: MIX_COLORS[index % 3] }} />
                      <span>{agreementTypeMeta[m.type].short}</span>
                      <span className="ml-auto font-medium tabular-nums">{m.count}</span>
                      <span className="w-20 text-right text-muted-foreground tabular-nums">{formatKESCompact(m.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Skeleton className="h-64" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dealership leaderboard</CardTitle>
          <CardDescription>Performance at a glance. Click a dealership to edit it.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Dealership</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Vehicles available</TableHead>
                <TableHead className="text-right">Active HP</TableHead>
                <TableHead className="min-w-48">Collected this month</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.dealerships ?? []).map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => openDialog({ type: "dealership", dealership: d })}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <DealershipChip code={d.code} />
                      <div className="grid">
                        <span className="font-medium">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.city}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={d.status === "active" ? "border-success/30 bg-success/12 text-success" : "text-muted-foreground"}
                    >
                      {d.status === "active" ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(d.customers)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(d.carsInStock)}
                    <span className="text-muted-foreground">/{formatNumber(d.cars)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(d.activeHp)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(d.collectedThisMonth / maxCollected) * 100}%`, background: dealershipChartColor(d.code) }}
                        />
                      </div>
                      <span className="w-20 text-right text-sm font-medium tabular-nums">{formatKESCompact(d.collectedThisMonth)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatKESCompact(d.outstanding)}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", d.overdue > 0 && "text-destructive")}>
                    {formatKESCompact(d.overdue)}
                  </TableCell>
                </TableRow>
              ))}
              {!data &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            Most overdue, platform-wide
          </CardTitle>
          <CardDescription>The oldest unpaid installments across every dealership</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/installments?filter=overdue">View all overdue</a>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 sm:grid-cols-2">
            {(data?.topOverdue ?? []).map((item) => (
              <li key={item.installmentId}>
                <button
                  type="button"
                  onClick={() => openDialog({ type: "agreement", id: item.agreementId })}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <span className="text-sm leading-none font-semibold tabular-nums">
                      {differenceInCalendarDays(parseISO(today), parseISO(item.dueDate))}
                    </span>
                    <span className="text-[9px] uppercase">days</span>
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{item.customerName ?? "—"}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DealershipChip code={item.dealershipCode} />
                      <span className="font-mono">{formatAgreementNumber(item.number, item.dealershipCode)}</span>
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatKES(item.remaining)}</span>
                </button>
              </li>
            ))}
            {data && data.topOverdue.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                <CarFront className="mx-auto mb-2 size-6" />
                Nothing overdue anywhere.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
