"use client"

import { endOfMonth, format, parseISO, startOfMonth, startOfYear, subDays } from "date-fns"
import { CalendarRange, Check, PlusCircle, SlidersHorizontal, X } from "lucide-react"
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates, type Parser } from "nuqs"
import { useMemo, useState, type ReactNode } from "react"
import type { DateRange } from "react-day-picker"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── State ───────────────────────────────────────────────────────────────────────────────────────────────────────────

type FilterKind = "multi" | "text" | "number"
type FilterValue<K extends FilterKind> = K extends "multi" ? string[] : K extends "number" ? number | null : string

const parserFor = (kind: FilterKind): Parser<unknown> =>
  (kind === "multi"
    ? parseAsArrayOf(parseAsString).withDefault([])
    : kind === "number"
      ? parseAsInteger
      : parseAsString.withDefault("")) as unknown as Parser<unknown>

/**
 * Table filters that live in the URL (shareable, survive reloads). Changing any filter jumps back to page 1.
 * `params` is ready to send to the API: multi-selects are comma-joined, which is what the server's listParam expects.
 */
export function useTableFilters<S extends Record<string, FilterKind>>(spec: S) {
  const parsers = useMemo(
    () => ({ ...Object.fromEntries(Object.entries(spec).map(([key, kind]) => [key, parserFor(kind)])), page: parseAsInteger }),
    // The spec is a static literal at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [state, setState] = useQueryStates(parsers, { history: "replace", clearOnDefault: true })
  const values = state as unknown as { [K in keyof S]: FilterValue<S[K]> }

  const set = <K extends keyof S>(key: K, value: FilterValue<S[K]> | null) =>
    void setState({ [key]: value, page: null } as never)

  /** Update several filters at once (e.g. both ends of a range) in a single URL write. */
  const setMany = (patch: { [K in keyof S]?: FilterValue<S[K]> | null }) => void setState({ ...patch, page: null } as never)

  const reset = () =>
    void setState(Object.fromEntries([...Object.keys(spec).map((key) => [key, null]), ["page", null]]) as never)

  const params: Record<string, string> = {}
  let active = 0
  for (const key of Object.keys(spec) as (keyof S & string)[]) {
    const value = values[key] as unknown
    if (Array.isArray(value) ? value.length : value !== null && value !== "" && value !== undefined) {
      params[key] = Array.isArray(value) ? value.join(",") : String(value)
      active++
    }
  }
  return { values, set, setMany, reset, params, active }
}

// ─── Faceted multi-select ────────────────────────────────────────────────────────────────────────────────────────────

export type FacetOption = { value: string; label: ReactNode; count?: number; icon?: ReactNode; keywords?: string }

export function FacetedFilter({
  title,
  options,
  selected,
  onChange,
  single,
}: {
  title: string
  options: FacetOption[]
  selected: string[]
  onChange: (values: string[]) => void
  /** Behave like radio buttons (e.g. "Available" vs "Sold"). */
  single?: boolean
}) {
  const chosen = new Set(selected)
  const labelFor = (value: string) => options.find((option) => option.value === value)?.label ?? value

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 border-dashed", chosen.size > 0 && "border-solid border-primary/50 bg-accent/60")}
        >
          <PlusCircle data-icon="inline-start" className={cn(chosen.size > 0 && "rotate-45 transition-transform")} />
          {title}
          {chosen.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 data-vertical:h-4" />
              {chosen.size > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
                  {chosen.size} selected
                </Badge>
              ) : (
                selected.map((value) => (
                  <Badge key={value} variant="secondary" className="max-w-32 truncate rounded-sm px-1.5 font-normal">
                    {labelFor(value)}
                  </Badge>
                ))
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          {options.length > 6 && <CommandInput placeholder={`Search ${title.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = chosen.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.keywords ?? ""} ${typeof option.label === "string" ? option.label : ""}`}
                    onSelect={() => {
                      if (single) return onChange(isSelected ? [] : [option.value])
                      const next = new Set(chosen)
                      if (isSelected) next.delete(option.value)
                      else next.add(option.value)
                      onChange([...next])
                    }}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border border-primary/60",
                        single ? "rounded-full" : "rounded-[4px]",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-60 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3" />
                    </span>
                    {option.icon}
                    <span className="truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{option.count}</span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {chosen.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center text-center">
                    Clear {title.toLowerCase()}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Date range ──────────────────────────────────────────────────────────────────────────────────────────────────────

const iso = (date: Date) => format(date, "yyyy-MM-dd")

export function DateRangeFilter({
  title,
  from,
  to,
  onChange,
}: {
  title: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const range: DateRange | undefined = from ? { from: parseISO(from), to: to ? parseISO(to) : undefined } : undefined
  const today = new Date()
  const presets: [string, Date, Date][] = [
    ["Last 7 days", subDays(today, 6), today],
    ["Last 30 days", subDays(today, 29), today],
    ["This month", startOfMonth(today), endOfMonth(today)],
    ["Last 90 days", subDays(today, 89), today],
    ["This year", startOfYear(today), today],
  ]
  const label = from
    ? `${format(parseISO(from), "d MMM")}${to && to !== from ? ` – ${format(parseISO(to), "d MMM yyyy")}` : ""}`
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 border-dashed", from && "border-solid border-primary/50 bg-accent/60")}>
          <CalendarRange data-icon="inline-start" />
          {title}
          {label && (
            <>
              <Separator orientation="vertical" className="mx-0.5 data-vertical:h-4" />
              <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
                {label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col gap-0 p-0 sm:flex-row" align="start">
        <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
          {presets.map(([name, start, end]) => (
            <Button
              key={name}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                onChange(iso(start), iso(end))
                setOpen(false)
              }}
            >
              {name}
            </Button>
          ))}
          {from && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={() => {
                onChange("", "")
                setOpen(false)
              }}
            >
              <X data-icon="inline-start" />
              Clear
            </Button>
          )}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={range?.from ?? subDays(today, 30)}
          selected={range}
          onSelect={(next) => {
            onChange(next?.from ? iso(next.from) : "", next?.to ? iso(next.to) : "")
            if (next?.from && next?.to && next.from.getTime() !== next.to.getTime()) setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Number range ────────────────────────────────────────────────────────────────────────────────────────────────────

export function NumberRangeFilter({
  title,
  min,
  max,
  onChange,
  format: formatValue = (value) => value.toLocaleString("en-KE"),
  placeholder = ["Min", "Max"],
}: {
  title: string
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
  format?: (value: number) => string
  placeholder?: [string, string]
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ min: min?.toString() ?? "", max: max?.toString() ?? "" })
  const active = min !== null || max !== null
  const label =
    min !== null && max !== null
      ? `${formatValue(min)} – ${formatValue(max)}`
      : min !== null
        ? `≥ ${formatValue(min)}`
        : max !== null
          ? `≤ ${formatValue(max)}`
          : null
  const toNumber = (value: string) => (value.trim() === "" ? null : Number(value.replace(/\D/g, "")))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft({ min: min?.toString() ?? "", max: max?.toString() ?? "" })
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 border-dashed", active && "border-solid border-primary/50 bg-accent/60")}>
          <SlidersHorizontal data-icon="inline-start" />
          {title}
          {label && (
            <>
              <Separator orientation="vertical" className="mx-0.5 data-vertical:h-4" />
              <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
                {label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            onChange(toNumber(draft.min), toNumber(draft.max))
            setOpen(false)
          }}
        >
          <p className="text-sm font-medium">{title}</p>
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              placeholder={placeholder[0]}
              value={draft.min}
              onChange={(event) => setDraft((d) => ({ ...d, min: event.target.value.replace(/\D/g, "") }))}
              aria-label={`${title} from`}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              inputMode="numeric"
              placeholder={placeholder[1]}
              value={draft.max}
              onChange={(event) => setDraft((d) => ({ ...d, max: event.target.value.replace(/\D/g, "") }))}
              aria-label={`${title} to`}
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null, null)
                setOpen(false)
              }}
            >
              Clear
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function ResetFilters({ active, onReset }: { active: number; onReset: () => void }) {
  if (!active) return null
  return (
    <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={onReset}>
      Reset {active > 1 ? `${active} filters` : "filter"}
      <X data-icon="inline-end" />
    </Button>
  )
}
