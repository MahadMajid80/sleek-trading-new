import { cn } from "@/lib/utils"

const PALETTE = [
  "bg-chart-1/20 text-foreground ring-chart-1/50",
  "bg-chart-2/20 text-foreground ring-chart-2/50",
  "bg-chart-3/20 text-foreground ring-chart-3/50",
  "bg-chart-4/20 text-foreground ring-chart-4/50",
  "bg-chart-5/20 text-foreground ring-chart-5/50",
]

/** Stable colour per dealership code, so each dealership is recognisable across every table and chart. */
export const dealershipColorIndex = (code: string) => [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTE.length
export const dealershipChartColor = (code: string) => `var(--chart-${dealershipColorIndex(code) + 1})`

export function DealershipChip({ code, name, className }: { code: string; name?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={name}>
      <span
        className={cn(
          "inline-flex h-5 min-w-9 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold tracking-wider ring-1",
          PALETTE[dealershipColorIndex(code)],
        )}
      >
        {code}
      </span>
      {name && <span className="truncate text-sm">{name}</span>}
    </span>
  )
}
