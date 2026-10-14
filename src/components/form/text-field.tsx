"use client"

import { useId, type ComponentProps } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type TextFieldProps<T extends FieldValues> = {
  // Output type is irrelevant to a field; accepting any lets schemas with transforms (string → number) through.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<T, any, any>
  name: FieldPath<T>
  label: string
  description?: string
  optional?: boolean
  /** Filters keystrokes, e.g. digits-only for phone numbers. */
  sanitize?: (value: string) => string
  className?: string
} & Pick<ComponentProps<"input">, "placeholder" | "inputMode" | "autoComplete" | "autoFocus" | "type" | "list" | "maxLength">

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  optional,
  sanitize,
  className,
  ...inputProps
}: TextFieldProps<T>) {
  const id = useId()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>
            {label}
            {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
          </FieldLabel>
          <Input
            {...inputProps}
            id={id}
            name={field.name}
            ref={field.ref}
            value={field.value ?? ""}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(sanitize ? sanitize(event.target.value) : event.target.value)}
            aria-invalid={fieldState.invalid}
            className="h-9"
          />
          {description && !fieldState.error && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export const digitsOnly = (value: string) => value.replace(/\D/g, "")
