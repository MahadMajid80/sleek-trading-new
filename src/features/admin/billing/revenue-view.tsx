"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleDollarSign, Gauge, Layers, Play, Repeat, Webhook } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/features/billing/meta"
import { useRevenueOverview, useRunRenewals } from "@/features/billing/queries"
import { BillingModeBanner, ProviderBadge } from "@/features/billing/ui"
import { ApiError } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { AdminPageHeader } from "../ui/admin-shell"
import { DealershipChip } from "../ui/dealership-chip"
import { StatTiles, TONES } from "../views/cells"

const chartConfig = {
  collected: { label: "Collected", color: "var(--chart-1)" },
  refunded: { label: "Refunded", color: "var(--chart-2)" },
} satisfies ChartConfig

export function AdminRevenueView() {
  const { data } = useRevenueOverview()
  const renewals = useRunRenewals()
  const money = (minor: number, compact = true) => formatMoney(minor, data?.currency ?? "kes", { compact })
  const change = data && data.collectedLastMonth > 0 ? (data.collectedThisMonth - data.collectedLastMonth) / data.collectedLastMonth : null

  const runRenewals = () =>
    renewals.mutate(undefined, {
      onSuccess: (r) =>
        toast.success("Billing cycle simulated", {
          description: `${r.renewed} renewed · ${r.paid} paid · ${r.failed} failed${r.canceled ? ` · ${r.canceled} ended` : ""}${r.retried ? ` · ${r.retried} retried` : ""}`,
        }),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't run the billing cycle"),
    })

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Revenue"
        description="Platform subscriptions paid by dealerships: recurring revenue, collections and payment health."
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href={"/admin/billing/plans" as Route}>
                <Layers data-icon="inline-start" />
                Plans
              </Link>
            </Button>
            <Button size="lg" asChild>
              <Link href={"/admin/billing/transactions" as Route}>
                <CircleDollarSign data-icon="inline-start" />
                All transactions
              </Link>
            </Button>
          </>
        }
      />

      {data && (
        <BillingModeBanner
          mode={data.mode}
          webhookConfigured={data.webhookConfigured}
          actions={
            data.mode === "sandbox" && (
              <Button variant="outline" size="sm" onClick={runRenewals} disabled={renewals.isPending}>
                <Play data-icon="inline-start" />
                {renewals.isPending ? "Running…" : "Simulate next billing cycle"}
              </Button>
            )
          }
        />
      )}

      <StatTiles
        items={[
          {
            label: "MRR",
            value: data && money(data.mrr),
            hint: data && `${money(data.arr)} ARR · ${money(data.arpa)} per dealership`,
            icon: Repeat,
            tone: TONES.gold,
          },
          {
            label: "Collected this month",
            value: data && money(data.collectedThisMonth),
            hint:
              data &&
              (change === null
                ? `${money(data.collectedLastMonth)} last month`
                : `${change >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(change * 100))}% vs ${money(data.collectedLastMonth)} last month`),
            icon: CircleDollarSign,
            tone: TONES.navy,
          },
          {
            label: "Outstanding",
            value: data && money(data.outstanding.amount),
            hint: data && `${data.outstanding.invoices} open invoice${data.outstanding.invoices === 1 ? "" : "s"} · ${data.subscriptions.pastDue} past due`,
            icon: AlertTriangle,
            tone: data && data.outstanding.amount > 0 ? TONES.rose : TONES.mono,
          },
          {
            label: "Subscriptions",
            value: data && formatNumber(data.subscriptions.active + data.subscriptions.trialing + data.subscriptions.pastDue),
            hint:
              data &&
              `${data.subscriptions.active} active · ${data.subscriptions.cancelingAtPeriodEnd} ending · ${data.subscriptions.churned30d} churned (30d)`,
            icon: Gauge,
            tone: TONES.mono,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Net collections</CardTitle>
            <CardDescription>Successful charges minus refunds, last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
                <BarChart data={data.trend} margin={{ left: 4, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(value: number) => money(value).replace(/[^\d.,KMB]/g, "")}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) =>
                          `${chartConfig[name as keyof typeof chartConfig]?.label ?? name}: ${money(Number(value), false)}${
                            name === "collected" && item.payload.failed ? ` · ${item.payload.failed} failed attempt(s)` : ""
                          }`
                        }
                      />
                    }
                  />
                  <Bar dataKey="collected" fill="var(--color-collected)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="refunded" fill="var(--color-refunded)" radius={[6, 6, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Skeleton className="h-72" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MRR by plan</CardTitle>
            <CardDescription>Where recurring revenue comes from</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!data && <Skeleton className="h-40" />}
            {data?.plans.map((plan) => (
              <div key={plan.plan} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{plan.plan}</span>
                  <span className="font-semibold tabular-nums">{money(plan.mrr)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-(--signal)" style={{ width: `${data.mrr ? (plan.mrr / data.mrr) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {plan.subscriptions} subscription{plan.subscriptions === 1 ? "" : "s"}
                </span>
              </div>
            ))}
            {data && data.plans.length === 0 && <p className="text-sm text-muted-foreground">No paying subscriptions yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Failed payments
            </CardTitle>
            <CardDescription>{data ? `${data.failedPayments30d} in the last 30 days` : "Recent declines"}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href={"/admin/billing/transactions?status=failed" as Route}>View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data?.recentFailures.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5">
                  <DealershipChip code={f.dealershipCode} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{f.dealershipName}</span>
                    <span className="truncate text-xs text-muted-foreground">{f.failureMessage ?? "Declined"}</span>
                  </span>
                  <span className="grid text-right">
                    <span className="text-sm font-semibold text-destructive tabular-nums">{money(f.amount, false)}</span>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(f.occurredAt), { addSuffix: true })}</span>
                  </span>
                </li>
              ))}
              {data && data.recentFailures.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No failed payments.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="size-4 text-accent-foreground" />
              Provider events
            </CardTitle>
            <CardDescription>Webhooks and simulated events, newest first</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href={"/admin/billing/events" as Route}>Event log</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data?.recentEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("size-2 shrink-0 rounded-full", e.error ? "bg-destructive" : "bg-(--signal)")} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-mono text-xs">{e.type}</span>
                    <span className="truncate text-xs text-muted-foreground">{e.error ?? e.summary ?? "—"}</span>
                  </span>
                  {e.dealershipCode && <DealershipChip code={e.dealershipCode} />}
                  <ProviderBadge provider={e.provider} />
                </li>
              ))}
              {data && data.recentEvents.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No events yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      {data && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {data.collectedThisMonth >= data.collectedLastMonth ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          MRR counts active, trialing and past-due subscriptions at their monthly price; yearly plans count as 1/12.
        </p>
      )}
    </div>
  )
}
