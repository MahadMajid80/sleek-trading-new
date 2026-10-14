"use client"

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatKES, formatKESCompact } from "@/lib/format"

const config = {
  collected: { label: "Collected", color: "var(--chart-1)" },
  customers: { label: "New customers", color: "var(--chart-2)" },
} satisfies ChartConfig

export function TrendChart({ data }: { data: { month: string; collected: number; customers: number }[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          yAxisId="money"
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value: number) => formatKESCompact(value).replace("Ksh", "").trim()}
        />
        <YAxis yAxisId="count" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {name === "collected" ? formatKES(Number(value)) : Number(value)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar yAxisId="money" dataKey="collected" fill="var(--color-collected)" radius={[6, 6, 0, 0]} maxBarSize={44} />
        <Line
          yAxisId="count"
          dataKey="customers"
          type="monotone"
          stroke="var(--color-customers)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-customers)" }}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  )
}
