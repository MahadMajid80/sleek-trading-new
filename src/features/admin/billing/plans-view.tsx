"use client"

import { Check, Layers, MoreHorizontal, Pencil, Plus, Trash2, Zap } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/features/billing/meta"
import { useAdminPlans, useDeletePlan, type BillingPlanRow } from "@/features/billing/queries"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { useAdminOptions } from "../queries"
import { AdminPageHeader } from "../ui/admin-shell"
import { PlanFormDialog } from "./plan-form-dialog"

export function AdminPlansView() {
  const plans = useAdminPlans()
  const remove = useDeletePlan()
  const dealerships = useAdminOptions()
  const [editing, setEditing] = useState<{ plan?: BillingPlanRow; session: number } | null>(null)
  const confirm = useConfirmState<BillingPlanRow>()
  const open = (plan?: BillingPlanRow) => setEditing((current) => ({ plan, session: (current?.session ?? 0) + 1 }))

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Plans"
        description="What dealerships can subscribe to. Prices sync to Stripe automatically on first checkout."
        actions={
          <Button size="lg" onClick={() => open()}>
            <Plus data-icon="inline-start" />
            New plan
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        {plans.data?.map((plan, index) => {
          // Highlight the middle plan only when there are several public ones to choose between.
          const featured = plans.data!.filter((p) => !p.dealershipId).length > 1 && index === 1 && plan.isActive && !plan.dealershipId
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl",
                featured && "ring-2 ring-(--signal) shadow-[0_0_40px_-12px_var(--btn-glow)]",
                !plan.isActive && "opacity-70",
              )}
            >
              {featured && (
                <div className="absolute top-0 right-0 rounded-bl-xl bg-(--signal) px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-(--signal-ink) uppercase">
                  Most popular
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="grid gap-1">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      {plan.name}
                      {!plan.isActive && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </CardTitle>
                    <span className="font-mono text-xs text-muted-foreground">{plan.dealershipName ? `Custom · ${plan.dealershipName}` : "Public"}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${plan.name}`} className={featured ? "mt-5" : undefined}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onSelect={() => open(plan)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => confirm.request(plan)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-semibold tracking-tight tabular-nums">{formatMoney(plan.amount, plan.currency)}</span>
                  <span className="text-sm text-muted-foreground">/ {plan.interval}</span>
                </div>
                <ul className="grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-(--signal) text-(--signal-ink)">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground tabular-nums">{plan.subscribers}</span> live subscription{plan.subscribers === 1 ? "" : "s"}
                </span>
                {plan.stripePriceId ? (
                  <span className="inline-flex items-center gap-1 font-mono" title={plan.stripePriceId}>
                    <Zap className="size-3" />
                    synced
                  </span>
                ) : (
                  <span>Not in Stripe yet</span>
                )}
              </CardFooter>
            </Card>
          )
        })}
        {plans.data?.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Layers className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No plans yet. Create one so dealerships can subscribe.</p>
              <Button onClick={() => open()}>
                <Plus data-icon="inline-start" />
                New plan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {editing && <PlanFormDialog key={editing.session} plan={editing.plan} dealerships={dealerships.data?.dealerships} onClose={() => setEditing(null)} />}

      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete the ${confirm.item?.name ?? ""} plan?`}
        description="Only plans nobody has ever subscribed to can be deleted. Deactivate a plan instead to hide it from new customers."
        onConfirm={() => {
          const plan = confirm.item
          confirm.onOpenChange(false)
          if (!plan) return
          remove.mutate(plan.id, {
            onSuccess: () => toast.success("Plan deleted", { description: plan.name }),
            onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete this plan"),
          })
        }}
      />
    </div>
  )
}
