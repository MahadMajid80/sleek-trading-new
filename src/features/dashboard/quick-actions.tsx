"use client"

import { AlertTriangle, ArrowRight, CarFront, FilePen, Search, UserPlus, type LucideIcon } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"

import { ModKey } from "@/components/mod-key"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useCommandStore } from "@/stores/command-store"
import { useDialogStore } from "@/stores/dialog-store"

function ActionButton({
  icon: Icon,
  title,
  description,
  onClick,
  hint,
}: {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  hint?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border bg-background/50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{description}</span>
      </span>
      {hint ?? (
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  )
}

export function QuickActions() {
  const router = useRouter()
  const openDialog = useDialogStore((state) => state.open)
  const setCommandOpen = useCommandStore((state) => state.setOpen)

  return (
    <div className="grid gap-2">
      <ActionButton
        icon={FilePen}
        title="New hire purchase"
        description="Agreement with an installment schedule"
        onClick={() => router.push("/agreements/new?type=hire_purchase" as Route)}
      />
      <ActionButton
        icon={AlertTriangle}
        title="Record a payment"
        description="Start from what's overdue"
        onClick={() => router.push("/installments?filter=overdue" as Route)}
      />
      <ActionButton
        icon={UserPlus}
        title="Add customer"
        description="Buyer, seller, witness or next of kin"
        onClick={() => openDialog({ type: "customer-form" })}
      />
      <ActionButton
        icon={CarFront}
        title="Add vehicle"
        description="New vehicle or a trade-in"
        onClick={() => openDialog({ type: "car-form" })}
      />
      <ActionButton
        icon={Search}
        title="Search everything"
        description="Customers, vehicles, pages and actions"
        onClick={() => setCommandOpen(true)}
        hint={
          <KbdGroup>
            <Kbd>
              <ModKey />
            </Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        }
      />
    </div>
  )
}
