"use client"

import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyControl<T extends FieldValues> = Control<T, any, any>

type BaseProps<T extends FieldValues> = {
  control: AnyControl<T>
  name: FieldPath<T>
  label: ReactNode
  description?: ReactNode
  optional?: boolean
  className?: string
}

function Label({ htmlFor, label, optional }: { htmlFor: string; label: ReactNode; optional?: boolean }) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {label}
      {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
    </FieldLabel>
  )
}

const withCommas = (digits: string) => (digits ? Number(digits).toLocaleString("en-KE") : "")

/** Whole-shilling amount stored as a digit string; shown with thousands separators. */
export function MoneyField<T extends FieldValues>({ control, name, label, description, optional, className, placeholder }: BaseProps<T> & { placeholder?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <Label htmlFor={id} label={label} optional={optional} />
          <InputGroup className="h-9">
            <InputGroupAddon>
              <InputGroupText className="text-xs font-medium">KSh</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id={id}
              ref={field.ref}
              name={field.name}
              inputMode="numeric"
              placeholder={placeholder ?? "0"}
              value={withCommas(field.value ?? "")}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12))}
              aria-invalid={fieldState.invalid}
              className="tabular-nums"
            />
          </InputGroup>
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  optional,
  className,
  options,
  placeholder,
}: BaseProps<T> & { options: readonly { value: string; label: ReactNode }[]; placeholder?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <Label htmlFor={id} label={label} optional={optional} />
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.invalid} className="h-9 w-full">
              <SelectValue placeholder={placeholder ?? "Select…"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function SwitchField<T extends FieldValues>({ control, name, label, description, className }: BaseProps<T>) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className={cn("rounded-lg border bg-background/50 p-3", className)}>
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldContent>
          <Switch id={id} ref={field.ref} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
        </Field>
      )}
    />
  )
}

/** Date stored as "yyyy-MM-dd". */
export function DateField<T extends FieldValues>({ control, name, label, description, optional, className }: BaseProps<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = field.value ? parseISO(field.value) : undefined
        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            <Label htmlFor={id} label={label} optional={optional} />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={id}
                  ref={field.ref}
                  type="button"
                  variant="outline"
                  aria-invalid={fieldState.invalid}
                  className={cn("h-9 w-full justify-start font-normal", !selected && "text-muted-foreground")}
                >
                  <CalendarIcon data-icon="inline-start" />
                  {selected ? format(selected, "EEE, d MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selected}
                  defaultMonth={selected}
                  captionLayout="dropdown"
                  onSelect={(date) => {
                    field.onChange(date ? format(date, "yyyy-MM-dd") : "")
                    setOpen(false)
                  }}
                />
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
