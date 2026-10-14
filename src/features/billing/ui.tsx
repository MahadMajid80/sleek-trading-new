"use client"

import { CreditCard, FlaskConical, ShieldCheck, Zap, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import type { BillingInvoiceStatus, BillingTransactionStatus, SubscriptionStatus } from "@/db/schema"
import { cn } from "@/lib/utils"

import {
  billingModeMeta,
  cardLabel,
  invoiceStatusMeta,
  subscriptionStatusMeta,
  transactionStatusMeta,
  type BillingMode,
} from "./meta"

export function SubscriptionStatusBadge({ status, cancelAtPeriodEnd }: { status: SubscriptionStatus; cancelAtPeriodEnd?: boolean }) {
  const meta = subscriptionStatusMeta[status]
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant="outline" className={meta.className}>
        {meta.label}
      </Badge>
      {cancelAtPeriodEnd && status !== "canceled" && (
        <Badge variant="outline" className="text-muted-foreground">
          Ends at period end
        </Badge>
      )}
    </span>
  )
}

export function InvoiceStatusBadge({ status }: { status: BillingInvoiceStatus }) {
  const meta = invoiceStatusMeta[status]
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

export function TransactionStatusBadge({ status }: { status: BillingTransactionStatus }) {
  const meta = transactionStatusMeta[status]
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

export function ProviderBadge({ provider }: { provider: "stripe" | "sandbox" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide uppercase ring-1",
        provider === "stripe" ? "bg-indigo-500/12 text-indigo-600 ring-indigo-500/25 dark:text-indigo-300" : "bg-muted text-muted-foreground ring-border",
      )}
    >
      {provider === "stripe" ? <Zap className="size-3" /> : <FlaskConical className="size-3" />}
      {provider}
    </span>
  )
}

export function CardOnFile({ brand, last4, className }: { brand: string | null; last4: string | null; className?: string }) {
  const label = cardLabel(brand, last4)
  if (!label) return <span className={cn("text-muted-foreground", className)}>No card</span>
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <CreditCard className="size-3.5 text-muted-foreground" />
      <span className="font-mono text-[14px]">{label}</span>
    </span>
  )
}

/** Explains where money is (or isn't) moving: sandbox simulation, Stripe test mode, or live. */
export function BillingModeBanner({ mode, webhookConfigured, actions }: { mode: BillingMode; webhookConfigured?: boolean; actions?: ReactNode }) {
  const meta = billingModeMeta[mode]
  const Icon: LucideIcon = mode === "sandbox" ? FlaskConical : mode === "stripe_test" ? Zap : ShieldCheck
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center",
        mode === "sandbox" && "border-dashed bg-muted/40",
        mode === "stripe_test" && "border-indigo-500/30 bg-indigo-500/6",
        mode === "stripe_live" && "border-success/30 bg-success/6",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            mode === "sandbox" ? "bg-foreground text-background" : mode === "stripe_test" ? "bg-indigo-500 text-white" : "bg-success text-white",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-semibold">{meta.label}</span>
          <span className="text-xs text-pretty text-muted-foreground">
            {meta.description}
            {mode !== "sandbox" && webhookConfigured === false && " Webhook secret missing: add STRIPE_WEBHOOK_SECRET so Stripe events sync."}
            {mode === "sandbox" && " Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.local to switch to Stripe."}
          </span>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: LucideIcon
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={destructive ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}>
            <Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
