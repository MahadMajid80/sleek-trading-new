"use client"

import { format, parseISO } from "date-fns"
import { AlertTriangle, ArrowRightLeft, CalendarX, Check, CreditCard, ExternalLink, FileText, Sparkles, Undo2 } from "lucide-react"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { formatMoney } from "./meta"
import {
  useBilling,
  useOpenPortal,
  usePayInvoice,
  useSandboxCard,
  useStartCheckout,
  useSubscriptionAction,
  type BillingPlanRow,
  type BillingSummaryData,
} from "./queries"
import { BillingModeBanner, CardOnFile, ConfirmActionDialog, InvoiceStatusBadge, SubscriptionStatusBadge } from "./ui"

const day = (value: string | null | undefined) => (value ? format(parseISO(value), "d MMM yyyy") : "—")
const errorMessage = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback)

export function BillingView() {
  const { data } = useBilling()
  const router = useRouter()
  const params = useSearchParams()
  const announced = useRef(false)

  // Returning from Stripe Checkout (or the sandbox checkout).
  useEffect(() => {
    const outcome = params.get("checkout")
    if (!outcome || announced.current) return
    announced.current = true
    if (outcome === "success") toast.success("Subscription started", { description: "Thanks! Your plan is active." })
    if (outcome === "canceled") toast("Checkout canceled", { description: "No charge was made." })
    router.replace("/billing" as Route, { scroll: false })
  }, [params, router])

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Billing" description="Your AutoVault subscription" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  const sub = data.subscription
  const live = sub && sub.status !== "canceled" && sub.status !== "incomplete_expired"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Billing" description="Your AutoVault subscription, payment method and invoices." />

      {data.mode === "sandbox" && <BillingModeBanner mode={data.mode} />}

      <OverdueAlert data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        {live ? <CurrentPlanCard data={data} /> : <NoPlanCard canceledAt={sub?.canceledAt ?? null} planName={sub?.planName} />}
        <PaymentMethodCard data={data} />
      </div>

      <PlanPicker data={data} />
      <InvoicesCard data={data} />
    </div>
  )
}

function OverdueAlert({ data }: { data: BillingSummaryData }) {
  const pay = usePayInvoice()
  const open = data.invoices.filter((invoice) => invoice.status === "open")
  if (open.length === 0) return null
  const owed = open.reduce((sum, invoice) => sum + invoice.amountRemaining, 0)
  const invoice = open[0]!
  return (
    <Alert variant="destructive" className="border-destructive/40 bg-destructive/6">
      <AlertTriangle />
      <AlertTitle>Payment failed: {formatMoney(owed, invoice.currency)} outstanding</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          We couldn&apos;t charge your card for invoice {invoice.number}. Update your card or retry the payment to keep your subscription active.
        </span>
        <Button
          size="sm"
          disabled={pay.isPending}
          onClick={() =>
            pay.mutate(invoice.id, {
              onSuccess: (result) =>
                result.paid ? toast.success("Payment successful", { description: `Invoice ${invoice.number} is paid.` }) : toast.error("Payment failed", { description: result.message }),
              onError: (error) => toast.error(errorMessage(error, "Couldn't retry the payment")),
            })
          }
        >
          <CreditCard data-icon="inline-start" />
          {pay.isPending ? "Charging…" : "Retry payment"}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function CurrentPlanCard({ data }: { data: BillingSummaryData }) {
  const sub = data.subscription!
  const act = useSubscriptionAction()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const plan = data.plans.find((p) => p.id === sub.planId)

  const toggleCancel = () => {
    setConfirmOpen(false)
    act.mutate(sub.cancelAtPeriodEnd ? { id: sub.id, action: "resume" } : { id: sub.id, action: "cancel", atPeriodEnd: true }, {
      onSuccess: () =>
        sub.cancelAtPeriodEnd
          ? toast.success("Subscription will continue")
          : toast.success("Cancellation scheduled", { description: `You keep access until ${day(sub.currentPeriodEnd)}.` }),
      onError: (error) => toast.error(errorMessage(error, "Couldn't update your subscription")),
    })
  }

  return (
    <Card className="relative overflow-hidden lg:col-span-2">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-primary/15 blur-3xl" />
      <CardHeader>
        <CardDescription>Current plan</CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-3 text-2xl">
          {sub.planName}
          <SubscriptionStatusBadge status={sub.status} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
        </CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <a href="#plans">
              <ArrowRightLeft data-icon="inline-start" />
              Change plan
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Price</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {formatMoney(sub.amount, sub.currency)}
            <span className="text-sm font-normal text-muted-foreground">/{sub.interval === "year" ? "yr" : "mo"}</span>
          </span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">{sub.cancelAtPeriodEnd ? "Access ends" : "Renews on"}</span>
          <span className="font-heading text-2xl font-semibold">{day(sub.currentPeriodEnd)}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Member since</span>
          <span className="font-heading text-2xl font-semibold">{format(parseISO(sub.createdAt), "MMM yyyy")}</span>
        </div>
        {plan && plan.features.length > 0 && (
          <ul className="grid gap-1.5 text-sm sm:col-span-3 sm:grid-cols-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-muted-foreground">
                <Check className="size-3.5 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} disabled={act.isPending}>
          {sub.cancelAtPeriodEnd ? <Undo2 data-icon="inline-start" /> : <CalendarX data-icon="inline-start" />}
          {sub.cancelAtPeriodEnd ? "Keep my subscription" : "Cancel subscription"}
        </Button>
      </CardFooter>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={sub.cancelAtPeriodEnd ? Undo2 : CalendarX}
        destructive={!sub.cancelAtPeriodEnd}
        title={sub.cancelAtPeriodEnd ? "Keep your subscription?" : "Cancel your subscription?"}
        description={
          sub.cancelAtPeriodEnd
            ? "Your plan will renew as normal."
            : `You keep full access until ${day(sub.currentPeriodEnd)}. After that you won't be charged again.`
        }
        confirmLabel={sub.cancelAtPeriodEnd ? "Keep subscription" : "Cancel at period end"}
        onConfirm={toggleCancel}
      />
    </Card>
  )
}

function NoPlanCard({ canceledAt, planName }: { canceledAt: string | null; planName?: string }) {
  return (
    <Card className="relative overflow-hidden lg:col-span-2">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-primary/15 blur-3xl" />
      <CardHeader>
        <CardDescription>Current plan</CardDescription>
        <CardTitle className="text-2xl">{canceledAt ? "No active subscription" : "Choose a plan to get started"}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {canceledAt
          ? `Your ${planName ?? ""} subscription ended on ${day(canceledAt)}. Pick a plan below to subscribe again.`
          : "Subscribe to a plan below. You'll be taken to a secure checkout to add your card."}
      </CardContent>
      <CardFooter>
        <Button asChild>
          <a href="#plans">
            <Sparkles data-icon="inline-start" />
            See plans
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

function PaymentMethodCard({ data }: { data: BillingSummaryData }) {
  const portal = useOpenPortal()
  const card = useSandboxCard()
  const account = data.account
  const sandbox = (account?.provider ?? (data.mode === "sandbox" ? "sandbox" : "stripe")) === "sandbox"

  return (
    <Card id="payment-method">
      <CardHeader>
        <CardDescription>Payment method</CardDescription>
        <CardTitle className="text-lg">
          <CardOnFile brand={account?.cardBrand ?? null} last4={account?.cardLast4 ?? null} className="text-base" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {account?.cardExpMonth && account.cardExpYear && (
          <span className="text-muted-foreground">
            Expires {String(account.cardExpMonth).padStart(2, "0")}/{account.cardExpYear}
          </span>
        )}
        {sandbox ? (
          account && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-3">
              <div className="grid gap-0.5">
                <Label htmlFor="sandbox-declines">Test card declines</Label>
                <span className="text-xs text-muted-foreground">Sandbox only: make the next charges fail to try the past-due flow.</span>
              </div>
              <Switch
                id="sandbox-declines"
                checked={account.sandboxCardDeclines}
                disabled={card.isPending}
                onCheckedChange={(declines) =>
                  card.mutate(declines, {
                    onSuccess: () => toast.success(declines ? "Test card now declines" : "Test card now approves"),
                    onError: (error) => toast.error(errorMessage(error, "Couldn't update the test card")),
                  })
                }
              />
            </div>
          )
        ) : (
          <Button
            variant="outline"
            disabled={portal.isPending}
            onClick={() =>
              portal.mutate(undefined, {
                onSuccess: ({ url }) => window.location.assign(url),
                onError: (error) => toast.error(errorMessage(error, "Couldn't open the billing portal")),
              })
            }
          >
            <ExternalLink data-icon="inline-start" />
            {portal.isPending ? "Opening…" : "Update card in Stripe"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function PlanPicker({ data }: { data: BillingSummaryData }) {
  const checkout = useStartCheckout()
  const act = useSubscriptionAction()
  const [pendingPlan, setPendingPlan] = useState<BillingPlanRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const sub = data.subscription
  const live = sub && sub.status !== "canceled" && sub.status !== "incomplete_expired" ? sub : null

  const choose = (plan: BillingPlanRow) => {
    if (live) {
      setPendingPlan(plan)
      setConfirmOpen(true)
      return
    }
    checkout.mutate(plan.id, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (error) => toast.error(errorMessage(error, "Couldn't start checkout")),
    })
  }

  return (
    <section id="plans" className="grid scroll-mt-20 gap-4">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Plans</h2>
        <p className="text-sm text-muted-foreground">Upgrade or downgrade any time.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {data.plans.map((plan, index) => {
          const current = live?.planId === plan.id
          const featured = index === 1
          return (
            <Card key={plan.id} className={cn("relative transition-all hover:-translate-y-0.5 hover:shadow-lg", current && "ring-2 ring-primary", featured && !current && "ring-1 ring-primary/40")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {plan.name}
                  {current ? <Badge>Your plan</Badge> : featured && <Badge variant="outline">Most popular</Badge>}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(plan.amount, plan.currency)}</span>
                  <span className="text-sm text-muted-foreground">/ {plan.interval}</span>
                </div>
                <ul className="grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  className="w-full"
                  variant={current ? "outline" : "default"}
                  disabled={current || checkout.isPending || act.isPending}
                  onClick={() => choose(plan)}
                >
                  {current ? "Current plan" : live ? `Switch to ${plan.name}` : checkout.isPending && checkout.variables === plan.id ? "Opening checkout…" : `Choose ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={ArrowRightLeft}
        title={`Switch to ${pendingPlan?.name ?? "this plan"}?`}
        description={
          pendingPlan && live
            ? live.provider === "stripe"
              ? `You'll pay ${formatMoney(pendingPlan.amount, pendingPlan.currency)}/${pendingPlan.interval}. The difference for the rest of this period is added to your next invoice.`
              : `You'll pay ${formatMoney(pendingPlan.amount, pendingPlan.currency)}/${pendingPlan.interval} from your next renewal on ${day(live.currentPeriodEnd)}.`
            : ""
        }
        confirmLabel="Switch plan"
        onConfirm={() => {
          setConfirmOpen(false)
          if (!pendingPlan || !live) return
          act.mutate(
            { id: live.id, action: "change_plan", planId: pendingPlan.id },
            {
              onSuccess: () => toast.success(`You're now on ${pendingPlan.name}`),
              onError: (error) => toast.error(errorMessage(error, "Couldn't change your plan")),
            },
          )
        }}
      />
    </section>
  )
}

function InvoicesCard({ data }: { data: BillingSummaryData }) {
  const pay = usePayInvoice()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Your subscription invoices, newest first</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Invoice</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  <span className="grid">
                    <span className="font-mono font-medium">{invoice.number ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{invoice.description}</span>
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {day(invoice.periodStart)} – {day(invoice.periodEnd)}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(invoice.amountDue, invoice.currency)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{day(invoice.paidAt)}</TableCell>
                <TableCell className="text-right">
                  {invoice.status === "open" ? (
                    <Button
                      size="sm"
                      disabled={pay.isPending}
                      onClick={() =>
                        pay.mutate(invoice.id, {
                          onSuccess: (result) =>
                            result.paid ? toast.success("Payment successful") : toast.error("Payment failed", { description: result.message }),
                          onError: (error) => toast.error(errorMessage(error, "Couldn't take payment")),
                        })
                      }
                    >
                      Pay now
                    </Button>
                  ) : invoice.invoicePdfUrl || invoice.hostedInvoiceUrl ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={invoice.invoicePdfUrl ?? invoice.hostedInvoiceUrl ?? undefined} target="_blank" rel="noreferrer">
                        <FileText data-icon="inline-start" />
                        View
                      </a>
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {data.invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
