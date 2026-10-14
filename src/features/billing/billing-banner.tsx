import { format } from "date-fns"
import { AlertTriangle, CalendarX, Sparkles } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"

import { cn } from "@/lib/utils"

import type { billingStatus } from "./server"

type Status = Awaited<ReturnType<typeof billingStatus>>

/** Staff-wide strip shown when the dealership's subscription needs attention. */
export function BillingBanner({ status }: { status: Status }) {
  const tone =
    status.status === "past_due" || status.status === "unpaid"
      ? {
          icon: AlertTriangle,
          text: "Your last subscription payment failed. Update your card to avoid interruption.",
          cta: "Fix billing",
          className: "border-destructive/30 bg-destructive/8 text-destructive",
        }
      : !status.status
        ? { icon: Sparkles, text: "This dealership has no active plan.", cta: "Choose a plan", className: "border-primary/30 bg-primary/8 text-foreground" }
        : status.cancelAtPeriodEnd && status.currentPeriodEnd
          ? {
              icon: CalendarX,
              text: `Your subscription ends on ${format(status.currentPeriodEnd, "d MMM yyyy")}.`,
              cta: "Keep subscription",
              className: "border-border bg-muted/60 text-muted-foreground",
            }
          : null
  if (!tone) return null
  const Icon = tone.icon
  return (
    <div className={cn("flex items-center gap-3 border-b px-4 py-2 text-sm md:px-6", tone.className)}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{tone.text}</span>
      <Link href={"/billing" as Route} className="shrink-0 font-semibold underline-offset-4 hover:underline">
        {tone.cta} →
      </Link>
    </div>
  )
}
