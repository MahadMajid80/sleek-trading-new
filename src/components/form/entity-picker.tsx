"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CarFront, Check, ChevronsUpDown, Plus, UserRound, X } from "lucide-react"
import { useEffect, useId, useState, type ReactNode } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import type { CarRow } from "@/features/cars/schema"
import type { CustomerRow } from "@/features/customers/schema"
import { apiFetch, type Paginated } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useDialogStore } from "@/stores/dialog-store"

export type PickerKind = "customer" | "car"

export type PickerOption = { id: string; title: string; subtitle: string }

const config = {
  customer: {
    url: "/api/customers",
    icon: UserRound,
    noun: "customer",
    toOption: (row: CustomerRow): PickerOption => ({
      id: row.id,
      title: row.name,
      subtitle: `${row.telephone} · ID ${row.nationalId}`,
    }),
  },
  car: {
    url: "/api/vehicles",
    icon: CarFront,
    noun: "vehicle",
    toOption: (row: CarRow): PickerOption => ({
      id: row.id,
      title: `${row.year} ${row.brand} ${row.name}`,
      subtitle: [row.regNo, row.chassisNo && `Chassis ${row.chassisNo}`, row.color].filter(Boolean).join(" · "),
    }),
  },
} as const

function useDebounced<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])
  return debounced
}

function usePickerOptions(kind: PickerKind, search: string, enabled: boolean) {
  const q = useDebounced(search.trim())
  return useQuery({
    queryKey: [kind === "customer" ? "customers" : "cars", "picker", q],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ perPage: "8", q, sort: kind === "customer" ? "name.asc" : "createdAt.desc" })
      const data = await apiFetch<Paginated<CustomerRow & CarRow>>(`${config[kind].url}?${params}`, { signal })
      return data.rows.map((row) => config[kind].toOption(row))
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function EntityPickerField<T extends FieldValues>({
  control,
  name,
  label,
  kind,
  initialOption,
  description,
  optional,
  className,
  onPick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<T, any, any>
  name: FieldPath<T>
  label: ReactNode
  kind: PickerKind
  /** Label for the pre-selected record when editing, so it shows without a lookup. */
  initialOption?: PickerOption | null
  description?: ReactNode
  optional?: boolean
  className?: string
  onPick?: (option: PickerOption | null) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [picked, setPicked] = useState<PickerOption | null>(initialOption ?? null)
  const options = usePickerOptions(kind, search, open)
  const openDialog = useDialogStore((state) => state.open)
  const Icon = config[kind].icon

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const current = picked?.id === field.value ? picked : null
        const choose = (option: PickerOption | null) => {
          setPicked(option)
          field.onChange(option?.id ?? "")
          onPick?.(option)
          setOpen(false)
          setSearch("")
        }
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            <FieldLabel htmlFor={id}>
              {label}
              {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
            </FieldLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <div className="relative">
                <PopoverTrigger asChild>
                  <Button
                    id={id}
                    ref={field.ref}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={fieldState.invalid}
                    onBlur={field.onBlur}
                    className={cn("h-auto min-h-9 w-full justify-start py-1.5 pr-14 text-left font-normal", !current && "text-muted-foreground")}
                  >
                    <Icon data-icon="inline-start" className="text-muted-foreground" />
                    {current ? (
                      <span className="grid min-w-0 leading-tight">
                        <span className="truncate font-medium text-foreground">{current.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{current.subtitle}</span>
                      </span>
                    ) : field.value ? (
                      <span className="truncate">Selected</span>
                    ) : (
                      <span className="truncate">Search {config[kind].noun}s…</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5">
                  {field.value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="pointer-events-auto text-muted-foreground"
                      onClick={() => choose(null)}
                      aria-label={`Clear ${config[kind].noun}`}
                    >
                      <X />
                    </Button>
                  )}
                  <ChevronsUpDown className="size-4 text-muted-foreground" />
                </div>
              </div>
              <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="relative">
                    <CommandInput value={search} onValueChange={setSearch} placeholder={`Name, phone, ID${kind === "car" ? ", reg or chassis" : ""}…`} />
                    {options.isFetching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />}
                  </div>
                  <CommandList>
                    {!options.isPending && <CommandEmpty>No {config[kind].noun}s found.</CommandEmpty>}
                    <CommandGroup>
                      {options.data?.map((option) => (
                        <CommandItem key={option.id} value={option.id} onSelect={() => choose(option)}>
                          <div className="grid min-w-0 flex-1">
                            <span className="truncate">{option.title}</span>
                            <span className="truncate text-xs text-muted-foreground">{option.subtitle}</span>
                          </div>
                          <Check className={cn("ml-auto", option.id === field.value ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup>
                      <CommandItem
                        value="__add"
                        onSelect={() => {
                          setOpen(false)
                          openDialog({ type: kind === "customer" ? "customer-form" : "car-form" })
                        }}
                        className="text-accent-foreground"
                      >
                        <Plus />
                        Add a new {config[kind].noun}
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}
