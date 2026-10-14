"use client"

import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatKES } from "@/lib/format"
import { cn } from "@/lib/utils"

import { DealershipChip } from "../ui/dealership-chip"

export const muted = <span className="text-muted-foreground">—</span>

export function DealershipCell({ code, name }: { code: string; name: string }) {
  return (
    <span className="flex min-w-36 items-center gap-2">
      <DealershipChip code={code} />
      <span className="truncate text-sm text-muted-foreground">{name}</span>
    </span>
  )
}

export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return muted
  return <span className={cn("font-medium whitespace-nowrap tabular-nums", className)}>{formatKES(value)}</span>
}

export function Ago({ value }: { value: string }) {
  return (
    <time dateTime={value} className="whitespace-nowrap text-muted-foreground" title={new Date(value).toLocaleString()}>
      {formatDistanceToNowStrict(new Date(value), { addSuffix: true })}
    </time>
  )
}

export function Day({ value }: { value: string }) {
  return <span className="whitespace-nowrap tabular-nums">{format(parseISO(value), "d MMM yyyy")}</span>
}

/** Row of glowing summary tiles above a table. `onClick` makes a tile act as a quick filter. */
export function StatTiles({
  items,
}: {
  items: {
    label: string
    value?: string
    hint?: string
    icon: LucideIcon
    tone: string
    active?: boolean
    onClick?: () => void
  }[]
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", items.length >= 4 ? "xl:grid-cols-4" : "lg:grid-cols-3")}>
      {items.map(({ label, value, hint, icon: Icon, tone, active, onClick }) => {
        const body = (
          <Card
            className={cn(
              "relative h-full overflow-hidden py-4 transition-all",
              onClick && "hover:-translate-y-0.5 hover:shadow-lg",
              active && "ring-2 ring-(--signal)/70",
            )}
          >
            <div aria-hidden className={cn("pointer-events-none absolute -top-12 -right-8 size-32 rounded-full opacity-20 blur-2xl", tone)} />
            <CardContent className="relative flex items-center gap-3 px-4">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl shadow-md", tone)}>
                <Icon className="size-4.5" />
              </span>
              <span className="grid min-w-0 text-left">
                <span className="text-xs text-muted-foreground">{label}</span>
                {value === undefined ? (
                  <Skeleton className="mt-1 h-6 w-20" />
                ) : (
                  <span className="font-heading text-xl font-semibold tracking-tight tabular-nums">{value}</span>
                )}
                {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
              </span>
            </CardContent>
          </Card>
        )
        return onClick ? (
          <button key={label} type="button" onClick={onClick} className="rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            {body}
          </button>
        ) : (
          <div key={label}>{body}</div>
        )
      })}
    </div>
  )
}

/** Icon-tile colour + matching text colour: gold takes navy text (like the buttons), navy takes white. */
export const TONES = {
  gold: "bg-(--signal) text-(--signal-ink)",
  navy: "bg-(--signal-2) text-white",
  rose: "bg-rose-500 text-white",
  amber: "bg-amber-400 text-(--signal-ink)",
  mono: "bg-foreground text-background",
}

export function DealershipStatusBadge({ status }: { status: "active" | "suspended" }) {
  return status === "active" ? (
    <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/12 text-success">
      <span className="size-1.5 rounded-full bg-success" />
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      Suspended
    </Badge>
  )
}
