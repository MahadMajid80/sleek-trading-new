"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { format, parseISO } from "date-fns"
import { ArrowRightLeft, Ban, CalendarX, MoreHorizontal, Repeat, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import type { AppFeatures } from "@/components/data-table/features"
import { FacetedFilter } from "@/components/data-table/filters"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatMoney, subscriptionStatusMeta } from "@/features/billing/meta"
import { useAdminPlans, useAdminSubscriptionAction, type SubscriptionAction, type SubscriptionRow } from "@/features/billing/queries"
import { ConfirmActionDialog, ProviderBadge, SubscriptionStatusBadge } from "@/features/billing/ui"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

import { AdminListPage, DealershipFilter, useAdminTable } from "../ui/admin-table"
import { DealershipCell, muted } from "../views/cells"

const helper = createColumnHelper<AppFeatures, SubscriptionRow>()

type Pending = { sub: SubscriptionRow; kind: "cancel_end" | "cancel_now" | "resume" } | null

export function AdminSubscriptionsView() {
  const plans = useAdminPlans()
  const act = useAdminSubscriptionAction()
  const [changing, setChanging] = useState<SubscriptionRow | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const run = (sub: SubscriptionRow, action: SubscriptionAction, success: string) =>
    act.mutate(
      { id: sub.id, ...action },
      {
        onSuccess: () => toast.success(success, { description: `${sub.dealershipCode} · ${sub.dealershipName}` }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update the subscription"),
      },
    )

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("dealershipCode", {
          header: "Dealership",
          meta: { label: "Dealership" },
          enableHiding: false,
          enableSorting: false,
          cell: ({ row }) => <DealershipCell code={row.original.dealershipCode} name={row.original.dealershipName} />,
        }),
        helper.accessor("planName", {
          header: "Plan",
          meta: { label: "Plan" },
          enableSorting: false,
          cell: ({ row }) => (
            <span className="grid">
              <span className="font-medium">{row.original.planName}</span>
              <span className="text-xs text-muted-foreground">{row.original.interval === "year" ? "Yearly" : "Monthly"}</span>
            </span>
          ),
        }),
        helper.accessor("status", {
          header: "Status",
          meta: { label: "Status" },
          enableSorting: false,
          cell: ({ row }) => <SubscriptionStatusBadge status={row.original.status} cancelAtPeriodEnd={row.original.cancelAtPeriodEnd} />,
        }),
        helper.accessor("amount", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
          meta: { label: "Price" },
          cell: ({ row }) => (
            <span className="font-medium whitespace-nowrap tabular-nums">
              {formatMoney(row.original.amount, row.original.currency)}
              <span className="text-xs font-normal text-muted-foreground">/{row.original.interval === "year" ? "yr" : "mo"}</span>
            </span>
          ),
        }),
        helper.accessor("openBalance", {
          header: "Owed",
          meta: { label: "Owed" },
          enableSorting: false,
          cell: ({ row }) =>
            row.original.openBalance > 0 ? (
              <span className="font-semibold whitespace-nowrap text-destructive tabular-nums">{formatMoney(row.original.openBalance, row.original.currency)}</span>
            ) : (
              muted
            ),
        }),
        helper.accessor("currentPeriodEnd", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Renews / ends" />,
          meta: { label: "Period end" },
          cell: ({ row }) =>
            row.original.status === "canceled" ? (
              <span className="text-muted-foreground">
                Ended {row.original.canceledAt ? format(parseISO(row.original.canceledAt), "d MMM yyyy") : ""}
              </span>
            ) : (
              <span className="whitespace-nowrap tabular-nums">{format(parseISO(row.original.currentPeriodEnd), "d MMM yyyy")}</span>
            ),
        }),
        helper.accessor("provider", {
          header: "Provider",
          meta: { label: "Provider" },
          enableSorting: false,
          cell: ({ getValue }) => <ProviderBadge provider={getValue()} />,
        }),
        helper.accessor("createdAt", {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Since" />,
          meta: { label: "Since" },
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{format(parseISO(getValue()), "MMM yyyy")}</span>,
        }),
        helper.display({
          id: "actions",
          meta: { className: "w-12" },
          cell: ({ row }) => {
            const sub = row.original
            if (sub.status === "canceled") return null
            return (
              <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${sub.dealershipName}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setChanging(sub)}>
                      <ArrowRightLeft />
                      Change plan
                    </DropdownMenuItem>
                    {sub.cancelAtPeriodEnd ? (
                      <DropdownMenuItem onSelect={() => (setPending({ sub, kind: "resume" }), setConfirmOpen(true))}>
                        <Undo2 />
                        Keep subscription
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => (setPending({ sub, kind: "cancel_end" }), setConfirmOpen(true))}>
                        <CalendarX />
                        Cancel at period end
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => (setPending({ sub, kind: "cancel_now" }), setConfirmOpen(true))}>
                      <Ban />
                      Cancel immediately
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        }),
      ]),
    [],
  )

  const { url, filters, query, table } = useAdminTable<SubscriptionRow, { status: "multi"; plan: "multi" }>({
    resource: "billing/subscriptions",
    defaultSort: "createdAt.desc",
    spec: { status: "multi", plan: "multi" },
    columns,
    hidden: { createdAt: false },
  })

  const confirm = () => {
    if (!pending) return
    setConfirmOpen(false)
    const { sub, kind } = pending
    if (kind === "resume") run(sub, { action: "resume" }, "Subscription will continue")
    else if (kind === "cancel_end") run(sub, { action: "cancel", atPeriodEnd: true }, "Subscription will end at period end")
    else run(sub, { action: "cancel", atPeriodEnd: false }, "Subscription canceled")
  }

  return (
    <>
      <AdminListPage
        title="Subscriptions"
        description="what each dealership pays the platform"
        count={query.data?.rowCount}
        search={url.params.q}
        onSearch={url.setSearch}
        searchPlaceholder="Search dealership, plan, subscription id…"
        filters={
          <>
            <DealershipFilter selected={filters.values.dealership} onChange={(v) => filters.set("dealership", v)} />
            <FacetedFilter
              title="Status"
              selected={filters.values.status}
              onChange={(v) => filters.set("status", v)}
              options={Object.entries(subscriptionStatusMeta).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <FacetedFilter
              title="Plan"
              selected={filters.values.plan}
              onChange={(v) => filters.set("plan", v)}
              options={(plans.data ?? []).map((plan) => ({ value: plan.id, label: plan.name, count: plan.subscribers }))}
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
        onRowClick={(sub) => sub.status !== "canceled" && setChanging(sub)}
        emptyIcon={Repeat}
        emptyTitle="No subscriptions"
      />

      <ChangePlanDialog
        sub={changing}
        onOpenChange={(open) => !open && setChanging(null)}
        onConfirm={(sub, planId, planName) => {
          setChanging(null)
          run(sub, { action: "change_plan", planId }, `Moved to ${planName}`)
        }}
      />

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={pending?.kind === "resume" ? Undo2 : pending?.kind === "cancel_now" ? Ban : CalendarX}
        destructive={pending?.kind === "cancel_now"}
        title={
          pending?.kind === "resume"
            ? "Keep this subscription?"
            : pending?.kind === "cancel_now"
              ? `Cancel ${pending?.sub.dealershipName} now?`
              : "Cancel at period end?"
        }
        description={
          pending?.kind === "resume"
            ? "The scheduled cancellation is withdrawn and the subscription renews as normal."
            : pending?.kind === "cancel_now"
              ? "Billing stops immediately and any open invoices on this subscription are voided. This can't be undone."
              : pending
                ? `The dealership keeps access until ${format(parseISO(pending.sub.currentPeriodEnd), "d MMM yyyy")}, then the subscription ends.`
                : ""
        }
        confirmLabel={pending?.kind === "resume" ? "Keep subscription" : pending?.kind === "cancel_now" ? "Cancel now" : "Schedule cancellation"}
        onConfirm={confirm}
      />
    </>
  )
}

export function ChangePlanDialog({
  sub,
  onOpenChange,
  onConfirm,
}: {
  sub: SubscriptionRow | null
  onOpenChange: (open: boolean) => void
  onConfirm: (sub: SubscriptionRow, planId: string, planName: string) => void
}) {
  const plans = useAdminPlans()
  const [selected, setSelected] = useState<string | null>(null)
  const value = selected ?? sub?.planId ?? ""
  const chosen = plans.data?.find((plan) => plan.id === value)

  return (
    <Dialog
      open={Boolean(sub)}
      onOpenChange={(open) => {
        if (!open) setSelected(null)
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            {sub?.dealershipName} · {sub?.provider === "stripe" ? "Stripe prorates the difference on the next invoice." : "The new price applies from the next renewal."}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={value} onValueChange={setSelected} className="gap-2">
          {/* Public plans and this dealership's own custom plans, never another dealership's. */}
          {plans.data
            ?.filter((plan) => !plan.dealershipId || plan.dealershipId === sub?.dealershipId)
            .map((plan) => (
            <label
              key={plan.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/60",
                value === plan.id && "border-(--signal) bg-(--signal)/8",
                !plan.isActive && "opacity-60",
              )}
            >
              <RadioGroupItem value={plan.id} />
              <span className="grid flex-1">
                <span className="font-medium">
                  {plan.name}
                  {plan.dealershipId && <span className="ml-2 text-xs font-normal text-muted-foreground">custom</span>}
                  {plan.id === sub?.planId && <span className="ml-2 text-xs font-normal text-muted-foreground">current</span>}
                  {!plan.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">inactive</span>}
                </span>
                <span className="text-xs text-muted-foreground">{plan.description}</span>
              </span>
              <span className="font-semibold whitespace-nowrap tabular-nums">
                {formatMoney(plan.amount, plan.currency)}
                <span className="text-xs font-normal text-muted-foreground">/{plan.interval === "year" ? "yr" : "mo"}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!sub || !chosen || chosen.id === sub.planId} onClick={() => sub && chosen && onConfirm(sub, chosen.id, chosen.name)}>
            <ArrowRightLeft data-icon="inline-start" />
            Move to {chosen?.name ?? "plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
