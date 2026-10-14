import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { AlertTriangle, ArrowUpRight, CarFront, CircleCheck, FilePen, Users, Wallet, type LucideIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import Link from "next/link"
import { connection } from "next/server"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-header"
import { Reveal } from "@/components/reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { agreementTypeMeta, formatAgreementNumber, typeBadgeClass } from "@/features/agreements/schema"
import { QuickActions } from "@/features/dashboard/quick-actions"
import { getDashboardData } from "@/features/dashboard/server"
import { TrendChart } from "@/features/dashboard/trend-chart"
import { todayISO } from "@/features/installments/ledger"
import { formatKES, formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { currentDealership } from "@/server/tenant"

export const metadata: Metadata = { title: "Dashboard" }

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-KE", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()))
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

function StatCard({
  icon: Icon,
  label,
  value,
  footer,
  delay,
  tone,
  href,
}: {
  icon: LucideIcon
  label: string
  value: string
  footer: ReactNode
  delay: number
  tone?: "danger"
  href: Route
}) {
  return (
    <Reveal delay={delay}>
      <Link href={href} className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <Card className="relative h-full overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-12 -right-12 size-32 rounded-full blur-2xl",
              tone === "danger" ? "bg-destructive/10" : "bg-primary/15",
            )}
          />
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className={cn("text-3xl font-semibold tracking-tight tabular-nums", tone === "danger" && "text-destructive")}>
              {value}
            </CardTitle>
            <CardAction>
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg ring-1",
                  tone === "danger" ? "bg-destructive/10 text-destructive ring-destructive/15" : "bg-primary/12 text-accent-foreground ring-primary/20",
                )}
              >
                <Icon className="size-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{footer}</CardContent>
        </Card>
      </Link>
    </Reveal>
  )
}

export default async function DashboardPage() {
  await connection()
  const dealership = await currentDealership()
  const { stats, trend, needsAttention, recentAgreements } = await getDashboardData(dealership.id)
  const today = todayISO()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greeting()}
        description={new Intl.DateTimeFormat("en-KE", { dateStyle: "full", timeZone: "Africa/Nairobi" }).format(new Date())}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Collected this month"
          value={formatKESCompact(stats.collectedThisMonth)}
          footer={`${formatKESCompact(stats.outstanding)} still outstanding`}
          delay={0}
          href="/payments"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={formatKESCompact(stats.overdue)}
          footer={
            stats.hpBehind ? `${formatNumber(stats.hpBehind)} of ${formatNumber(stats.activeHp)} hire purchase customers behind` : "Everyone is up to date"
          }
          delay={0.05}
          tone={stats.overdue > 0 ? "danger" : undefined}
          href={"/installments?filter=overdue" as Route}
        />
        <StatCard
          icon={FilePen}
          label="Active hire purchase"
          value={formatNumber(stats.activeHp)}
          footer="Agreements with installments still due"
          delay={0.1}
          href={"/agreements?type=hire_purchase" as Route}
        />
        <StatCard
          icon={CarFront}
          label="Vehicles available"
          value={formatNumber(stats.carsInStock)}
          footer={
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {formatNumber(stats.customerCount)} customers · +{formatNumber(stats.customersThisMonth)} this month
            </span>
          }
          delay={0.15}
          href="/vehicles"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal delay={0.2} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Collections</CardTitle>
              <CardDescription>Installment payments received and new customers, last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trend} />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.25}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Common tasks, one click away</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickActions />
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal delay={0.3}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Longest-overdue installments</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={"/installments?filter=overdue" as Route}>
                    All overdue
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {needsAttention.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                  <CircleCheck className="size-8 text-success" />
                  Nothing overdue. Nice.
                </div>
              ) : (
                <ul className="-mx-2 grid gap-1">
                  {needsAttention.map((item) => {
                    const days = differenceInCalendarDays(parseISO(today), parseISO(item.dueDate))
                    return (
                      <li key={item.installmentId}>
                        <Link
                          href={`/agreements/${item.agreementId}?pay=${item.installmentId}` as Route}
                          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                        >
                          <div className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                            <span className="text-sm leading-none font-semibold tabular-nums">{days}</span>
                            <span className="text-[9px] leading-none uppercase">days</span>
                          </div>
                          <div className="grid min-w-0 flex-1">
                            <span className="truncate text-sm font-medium">{item.customerName ?? "—"}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              <span className="font-mono">{formatAgreementNumber(item.number, dealership.code)}</span> · installment #{item.sequence} · due{" "}
                              {format(parseISO(item.dueDate), "d MMM")}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatKES(item.remaining)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.35}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent agreements</CardTitle>
              <CardDescription>Latest deals signed</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/agreements">
                    View all
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {recentAgreements.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No agreements yet.</p>
              ) : (
                <ul className="-mx-2 grid gap-1">
                  {recentAgreements.map((agreement) => (
                    <li key={agreement.id}>
                      <Link
                        href={`/agreements/${agreement.id}` as Route}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                      >
                        <span className="w-20 shrink-0 font-mono text-xs font-semibold">{formatAgreementNumber(agreement.number, dealership.code)}</span>
                        <div className="grid min-w-0 flex-1">
                          <span className="truncate text-sm font-medium">{agreement.customerName ?? "—"}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {agreement.carTitle} · {formatDistanceToNowStrict(agreement.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0", typeBadgeClass[agreement.type])}>
                          {agreementTypeMeta[agreement.type].short}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}
