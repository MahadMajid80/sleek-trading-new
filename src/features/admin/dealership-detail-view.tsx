"use client"

import { useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarClock,
  CarFront,
  ExternalLink,
  FilePen,
  KeyRound,
  Layers,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { FormDialog } from "@/components/form/form-dialog"
import { TextField } from "@/components/form/text-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FieldGroup } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandingForm } from "@/features/branding/branding-form"
import { formatMoney } from "@/features/billing/meta"
import { useAdminSubscriptionAction, type BillingPlanRow, type SubscriptionRow } from "@/features/billing/queries"
import { CardOnFile, ConfirmActionDialog, InvoiceStatusBadge, SubscriptionStatusBadge } from "@/features/billing/ui"
import { ApiError } from "@/lib/api-client"
import { countryName } from "@/lib/countries"
import { formatKESCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { ChangePlanDialog } from "./billing/subscriptions-view"
import { PlanFormDialog } from "./billing/plan-form-dialog"
import {
  useAddManager,
  useDealershipDetail,
  useManagerAction,
  useUpdateDealership,
  type AdminManager,
  type DealershipDetailData,
} from "./queries"
import { useAdminDialog } from "./ui/admin-dialogs"
import { DealershipLogo } from "./ui/dealership-logo"
import { DealershipStatusBadge, StatTiles, TONES } from "./views/cells"

const TABS = ["overview", "admins", "branding", "plan", "data"] as const
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  overview: "Overview",
  admins: "Admins",
  branding: "Branding",
  plan: "Plan & billing",
  data: "Data",
}

const day = (value: string | null | undefined) => (value ? format(parseISO(value), "d MMM yyyy") : "—")

export function DealershipDetailView({ id }: { id: string }) {
  const { data, error } = useDealershipDetail(id)
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("overview").withOptions({ history: "replace", clearOnDefault: true }))

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {error instanceof ApiError && error.status === 404 ? "This dealership doesn't exist." : "Couldn't load this dealership."}
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  const { dealership: d } = data
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <Header data={data} />

      <StatTiles
        items={[
          { label: "Customers", value: formatNumber(d.customers), hint: "On file", icon: Users, tone: TONES.navy },
          { label: "Vehicles", value: `${formatNumber(d.carsInStock)} / ${formatNumber(d.cars)}`, hint: "Available / total", icon: CarFront, tone: TONES.gold },
          { label: "Collected this month", value: formatKESCompact(d.collectedThisMonth), hint: `${formatKESCompact(d.outstanding)} outstanding`, icon: Wallet, tone: TONES.mono },
          {
            label: "Overdue",
            value: formatKESCompact(d.overdue),
            hint: `${formatNumber(d.activeHp)} active hire purchase`,
            icon: CalendarClock,
            tone: d.overdue > 0 ? TONES.rose : TONES.mono,
          },
        ]}
      />

      <Tabs value={tab} onValueChange={(value) => void setTab(value as (typeof TABS)[number])}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "admins" && <AdminsTab data={data} />}
      {tab === "branding" && <BrandingTab data={data} />}
      {tab === "plan" && <PlanTab data={data} />}
      {tab === "data" && <DataTab data={data} />}
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" className="w-fit -ml-2" asChild>
      <Link href={"/admin/dealerships" as Route}>
        <ArrowLeft data-icon="inline-start" />
        All dealerships
      </Link>
    </Button>
  )
}

function Header({ data }: { data: DealershipDetailData }) {
  const d = data.dealership
  const openDialog = useAdminDialog((state) => state.open)
  const update = useUpdateDealership()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const suspending = d.status === "active"

  const toggle = () => {
    setConfirmOpen(false)
    update.mutate(
      { id: d.id, values: { name: d.name, country: d.country, city: d.city, phone: d.phone ?? "", email: d.email ?? "", status: suspending ? "suspended" : "active" } },
      {
        onSuccess: () => toast.success(suspending ? "Dealership suspended" : "Dealership reactivated", { description: d.name }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update dealership"),
      },
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <DealershipLogo dealership={d} className="size-16 rounded-xl" />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-3xl font-bold tracking-tight">{d.name}</h1>
            <DealershipStatusBadge status={d.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {d.city}, {countryName(d.country)}
            {d.phone && <span className="font-mono"> · {d.phone}</span>}
            {d.email && <> · {d.email}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={() => openDialog({ type: "dealership", dealership: d })}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button variant={suspending ? "outline" : "default"} onClick={() => setConfirmOpen(true)} disabled={update.isPending}>
            {suspending ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {suspending ? "Suspend" : "Reactivate"}
          </Button>
        </div>
      </div>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={suspending ? Pause : Play}
        destructive={suspending}
        title={suspending ? `Suspend ${d.name}?` : `Reactivate ${d.name}?`}
        description={
          suspending
            ? "Its admins are signed out straight away and can't sign in until you reactivate it. All data is kept."
            : "Its admins can sign in again."
        }
        confirmLabel={suspending ? "Suspend" : "Reactivate"}
        onConfirm={toggle}
      />
    </>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────────────────────────────────────────────

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function OverviewTab({ data }: { data: DealershipDetailData }) {
  const { dealership: d, billing, managers } = data
  const sub = billing.subscription
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Detail label="Name">{d.name}</Detail>
            <Detail label="Country">{countryName(d.country)}</Detail>
            <Detail label="City">{d.city}</Detail>
            <Detail label="Phone">{d.phone ? <span className="font-mono">{d.phone}</span> : "—"}</Detail>
            <Detail label="Email">{d.email ?? "—"}</Detail>
            <Detail label="Status">
              <DealershipStatusBadge status={d.status} />
            </Detail>
            <Detail label="Dashboard title">{d.brandTitle || <span className="text-muted-foreground">Default (dealership name)</span>}</Detail>
            <Detail label="Agreement numbers">
              <span className="font-mono">{d.code}-1001</span> <span className="text-xs font-normal text-muted-foreground">style</span>
            </Detail>
            <Detail label="Opened">{day(d.createdAt)}</Detail>
            <Detail label="Last payment received">{d.lastPaymentOn ? day(d.lastPaymentOn) : "—"}</Detail>
          </dl>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {sub ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{sub.planName}</span>
                  <SubscriptionStatusBadge status={sub.status} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
                </div>
                <span className="text-muted-foreground">
                  {formatMoney(sub.amount, sub.currency)}/{sub.interval === "year" ? "yr" : "mo"} · {sub.status === "canceled" ? "ended" : "renews"} {day(sub.status === "canceled" ? sub.canceledAt : sub.currentPeriodEnd)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No subscription yet.</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admins</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {managers.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <span className="grid min-w-0">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.lastLoginAt ? formatDistanceToNowStrict(parseISO(m.lastLoginAt), { addSuffix: true }) : "Never signed in"}</span>
              </div>
            ))}
            {managers.length === 0 && <span className="text-muted-foreground">No admins.</span>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Admins ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const managerForm = z.object({ name: z.string().trim().min(2, "Enter the admin's name").max(80), email: z.email("Enter a valid email").max(120) })

function AdminsTab({ data }: { data: DealershipDetailData }) {
  const dealershipId = data.dealership.id
  const openDialog = useAdminDialog((state) => state.open)
  const action = useManagerAction(dealershipId)
  const [adding, setAdding] = useState(false)
  const [target, setTarget] = useState<{ manager: AdminManager; kind: "reset" | "disable" } | null>(null)

  const run = (manager: AdminManager, kind: "reset_password" | "disable" | "enable") =>
    action.mutate(
      { userId: manager.id, action: kind },
      {
        onSuccess: (result) => {
          if (result.credentials) openDialog({ type: "credentials", heading: `New password for ${manager.name}`, credentials: result.credentials })
          else toast.success(kind === "disable" ? "Admin disabled" : "Admin enabled", { description: manager.name })
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update this admin"),
      },
    )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Dealership admins</CardTitle>
          <CardDescription>The people who sign in to manage {data.dealership.name}. They see only this dealership&apos;s data.</CardDescription>
          <CardAction>
            <Button onClick={() => setAdding(true)}>
              <UserPlus data-icon="inline-start" />
              Add admin
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.managers.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {m.status === "active" ? (
                        <Badge variant="outline" className="border-success/30 bg-success/12 text-success">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                      {m.mustChangePassword && (
                        <Badge variant="outline" className="border-warning/40 bg-warning/12 text-warning">
                          Temporary password
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {m.lastLoginAt ? formatDistanceToNowStrict(parseISO(m.lastLoginAt), { addSuffix: true }) : "Never"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={() => setTarget({ manager: m, kind: "reset" })}>
                          <KeyRound />
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {m.status === "active" ? (
                          <DropdownMenuItem variant="destructive" onSelect={() => setTarget({ manager: m, kind: "disable" })}>
                            <Pause />
                            Disable sign-in
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => run(m, "enable")}>
                            <Play />
                            Enable sign-in
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {data.managers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No admins yet, so nobody can sign in to this dealership. Add one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {adding && <AddAdminDialog dealershipId={dealershipId} onClose={() => setAdding(false)} />}

      <ConfirmActionDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        icon={target?.kind === "reset" ? KeyRound : Pause}
        destructive={target?.kind === "disable"}
        title={target?.kind === "reset" ? `Reset ${target.manager.name}'s password?` : `Disable ${target?.manager.name}?`}
        description={
          target?.kind === "reset"
            ? "A new temporary password is generated and shown once. They are signed out everywhere and must choose a new password."
            : "They are signed out everywhere and can't sign in until you enable them again."
        }
        confirmLabel={target?.kind === "reset" ? "Reset password" : "Disable"}
        onConfirm={() => {
          const current = target
          setTarget(null)
          if (current) run(current.manager, current.kind === "reset" ? "reset_password" : "disable")
        }}
      />
    </>
  )
}

function AddAdminDialog({ dealershipId, onClose }: { dealershipId: string; onClose: () => void }) {
  const [open, setOpen] = useState(true)
  const add = useAddManager(dealershipId)
  const openDialog = useAdminDialog((state) => state.open)
  const form = useForm<z.input<typeof managerForm>>({ resolver: zodResolver(managerForm), defaultValues: { name: "", email: "" }, mode: "onTouched" })
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 200)
  }
  const submit = form.handleSubmit(async (values) => {
    try {
      const { credentials } = await add.mutateAsync(values)
      close()
      openDialog({ type: "credentials", heading: `${values.name} can now sign in`, credentials })
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      icon={UserPlus}
      title="Add dealership admin"
      description="They get a temporary password to sign in with, shown once on the next screen."
      submitLabel="Add admin"
      isSubmitting={form.formState.isSubmitting}
      onSubmit={submit}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField control={form.control} name="name" label="Name" placeholder="Jane Wanjiru" autoFocus autoComplete="off" />
        <TextField control={form.control} name="email" label="Email" type="email" placeholder="jane@example.com" autoComplete="off" />
      </FieldGroup>
    </FormDialog>
  )
}

// ─── Branding ────────────────────────────────────────────────────────────────────────────────────────────────────────

function BrandingTab({ data }: { data: DealershipDetailData }) {
  const queryClient = useQueryClient()
  const d = data.dealership
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        The dealership&apos;s admins can change this themselves from Settings. Changes you make here apply to their dashboard immediately.
      </p>
      <BrandingForm
        key={d.updatedAt}
        dealership={d}
        endpoints={{
          settings: `/api/admin/dealerships/${d.id}/branding`,
          logo: `/api/admin/dealerships/${d.id}/logo`,
          logoImage: `/api/dealerships/${d.id}/logo`,
        }}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ["admin"] })}
      />
    </div>
  )
}

// ─── Plan & billing ──────────────────────────────────────────────────────────────────────────────────────────────────

function PlanTab({ data }: { data: DealershipDetailData }) {
  const d = data.dealership
  const sub = data.billing.subscription
  const live = sub && sub.status !== "canceled" && sub.status !== "incomplete_expired"
  const act = useAdminSubscriptionAction()
  const [changing, setChanging] = useState<SubscriptionRow | null>(null)
  const [planForm, setPlanForm] = useState<{ plan?: BillingPlanRow; session: number } | null>(null)
  const openPlanForm = (plan?: BillingPlanRow) => setPlanForm((current) => ({ plan, session: (current?.session ?? 0) + 1 }))
  const custom = data.plans.filter((p) => p.dealershipId)
  const publicPlans = data.plans.filter((p) => !p.dealershipId)

  // ChangePlanDialog works on the rows of the subscriptions table; the detail response has the same facts.
  const asRow = (s: NonNullable<typeof sub>): SubscriptionRow => ({
    ...s,
    dealershipCode: d.code,
    dealershipName: d.name,
    openBalance: 0,
  })

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            {live && sub && (
              <CardAction>
                <Button variant="outline" onClick={() => setChanging(asRow(sub))}>
                  <ArrowRightLeft data-icon="inline-start" />
                  Change plan
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Plan</span>
                  <span className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                    {sub.planName}
                    <SubscriptionStatusBadge status={sub.status} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Price</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatMoney(sub.amount, sub.currency)}
                    <span className="text-sm font-normal text-muted-foreground">/{sub.interval === "year" ? "yr" : "mo"}</span>
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{sub.status === "canceled" ? "Ended" : sub.cancelAtPeriodEnd ? "Ends" : "Renews"}</span>
                  <span className="text-lg font-semibold">{day(sub.status === "canceled" ? sub.canceledAt : sub.currentPeriodEnd)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This dealership isn&apos;t subscribed yet. Its admin can choose a plan under Billing, including any custom plan you create for them below.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment method</CardTitle>
          </CardHeader>
          <CardContent>
            <CardOnFile brand={data.billing.account?.cardBrand ?? null} last4={data.billing.account?.cardLast4 ?? null} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4" />
            Plans this dealership can choose
          </CardTitle>
          <CardDescription>Public plans, plus custom plans made only for {d.name}.</CardDescription>
          <CardAction>
            <Button onClick={() => openPlanForm()}>
              <Plus data-icon="inline-start" />
              Custom plan
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...publicPlans, ...custom].map((plan) => (
            <div key={plan.id} className={cn("grid content-start gap-2 rounded-xl border p-4", plan.id === sub?.planId && live && "border-(--gold) bg-accent", !plan.isActive && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <span className="grid">
                  <span className="font-semibold">{plan.name}</span>
                  <span className="text-xs text-muted-foreground">{plan.dealershipId ? "Custom, only this dealership" : "Public"}</span>
                </span>
                {plan.dealershipId && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${plan.name}`} onClick={() => openPlanForm(plan)}>
                    <Pencil />
                  </Button>
                )}
              </div>
              <span className="text-xl font-bold tabular-nums">
                {formatMoney(plan.amount, plan.currency)}
                <span className="text-sm font-normal text-muted-foreground">/{plan.interval === "year" ? "yr" : "mo"}</span>
              </span>
              {plan.description && <span className="text-sm text-muted-foreground">{plan.description}</span>}
              <div className="flex flex-wrap gap-1.5">
                {plan.id === sub?.planId && live && <Badge>Current</Badge>}
                {!plan.isActive && <Badge variant="outline">Inactive</Badge>}
              </div>
            </div>
          ))}
          {custom.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-2">
              No custom plan yet. Create one to give this dealership its own price or features.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/billing/invoices?dealership=${d.id}` as Route}>
                View all
                <ExternalLink data-icon="inline-end" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Invoice</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.billing.invoices.slice(0, 6).map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono font-medium">{invoice.number ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{day(invoice.issuedAt)}</TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(invoice.amountDue, invoice.currency)}</TableCell>
                </TableRow>
              ))}
              {data.billing.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {planForm && <PlanFormDialog key={planForm.session} plan={planForm.plan} dealership={{ id: d.id, name: d.name }} onClose={() => setPlanForm(null)} />}

      <ChangePlanDialog
        sub={changing}
        onOpenChange={(open) => !open && setChanging(null)}
        onConfirm={(row, planId, planName) => {
          setChanging(null)
          act.mutate(
            { id: row.id, action: "change_plan", planId },
            {
              onSuccess: () => toast.success(`Moved to ${planName}`, { description: d.name }),
              onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't change the plan"),
            },
          )
        }}
      />
    </div>
  )
}

// ─── Data ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function DataTab({ data }: { data: DealershipDetailData }) {
  const d = data.dealership
  const links = [
    { title: "Customers", href: "/admin/customers", icon: Users, hint: `${formatNumber(d.customers)} on file` },
    { title: "Vehicles", href: "/admin/vehicles", icon: CarFront, hint: `${formatNumber(d.carsInStock)} available of ${formatNumber(d.cars)}` },
    { title: "Agreements", href: "/admin/agreements", icon: FilePen, hint: `${formatNumber(d.agreements)} signed` },
    { title: "Installments", href: "/admin/installments", icon: CalendarClock, hint: `${formatKESCompact(d.overdue)} overdue` },
    { title: "Customer payments", href: "/admin/payments", icon: Wallet, hint: `${formatKESCompact(d.collectedAllTime)} collected all time` },
    { title: "Sales invoices", href: "/admin/invoices", icon: Receipt, hint: "Proforma and final" },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {links.map(({ title, href, icon: Icon, hint }) => (
        <Link
          key={title}
          href={`${href}?dealership=${d.id}` as Route}
          className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-(--shadow-card) transition-all hover:-translate-y-0.5 hover:border-(--gold)"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold">{title}</span>
            <span className="truncate text-sm text-muted-foreground">{hint}</span>
          </span>
          <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Link>
      ))}
    </div>
  )
}

