"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Layers, Pencil } from "lucide-react"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { MoneyField, SelectField, SwitchField } from "@/components/form/fields"
import { FormDialog } from "@/components/form/form-dialog"
import { TextField } from "@/components/form/text-field"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useSavePlan, type BillingPlanRow } from "@/features/billing/queries"

const formSchema = z.object({
  name: z.string().trim().min(2, "Enter a plan name").max(40),
  description: z.string().trim().max(200),
  price: z.string().regex(/^[1-9]\d*$/, "Enter a price"),
  currency: z.enum(["kes", "usd", "eur", "gbp"]),
  interval: z.enum(["month", "year"]),
  features: z.string().max(1200),
  isActive: z.boolean(),
  /** "" = public plan for everyone; otherwise a dealership id (custom plan). Only chosen when creating. */
  dealershipId: z.string(),
})
type FormValues = z.input<typeof formSchema>

export type PlanDealershipOption = { id: string; name: string }

/**
 * Create or edit a plan. Plans are either public (every dealership can choose them) or custom (made for one dealership,
 * invisible to the rest). Pass `dealership` to lock a new plan to that dealership, or `dealerships` to let the admin choose.
 */
export function PlanFormDialog({
  plan,
  dealership,
  dealerships,
  onClose,
}: {
  plan?: BillingPlanRow
  dealership?: PlanDealershipOption
  dealerships?: PlanDealershipOption[]
  onClose: () => void
}) {
  const [open, setOpen] = useState(true)
  const save = useSavePlan()
  const featuresId = useId()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: plan
      ? {
          name: plan.name,
          description: plan.description,
          price: String(Math.round(plan.amount / 100)),
          currency: (["kes", "usd", "eur", "gbp"].includes(plan.currency) ? plan.currency : "kes") as FormValues["currency"],
          interval: plan.interval,
          features: plan.features.join("\n"),
          isActive: plan.isActive,
          dealershipId: plan.dealershipId ?? "",
        }
      : {
          name: "",
          description: "",
          price: "",
          currency: "kes",
          interval: "month",
          features: "",
          isActive: true,
          dealershipId: dealership?.id ?? "",
        },
  })
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 200)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { dealershipId, ...rest } = values
      await save.mutateAsync({
        id: plan?.id,
        values: {
          ...rest,
          price: Number(values.price),
          features: values.features
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          // Who a plan belongs to is fixed at creation.
          ...(plan ? {} : { dealershipId: dealershipId || null }),
        },
      })
      toast.success(plan ? "Plan updated" : "Plan created", { description: values.name })
      close()
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  const price = useWatch({ control: form.control, name: "price" })
  const priceChanged = plan && price !== String(Math.round(plan.amount / 100))
  const owner = plan ? (plan.dealershipName ? `Custom plan for ${plan.dealershipName}` : "Public plan") : null

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      icon={plan ? Pencil : Layers}
      title={plan ? `Edit ${plan.name}` : dealership ? `Custom plan for ${dealership.name}` : "New plan"}
      description={
        dealership
          ? "Only this dealership will see this plan when choosing or changing their plan."
          : "Dealerships see the name, price, description and features when choosing a plan."
      }
      submitLabel={plan ? "Save plan" : "Create plan"}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-6">
        <TextField control={form.control} name="name" label="Name" placeholder="Growth" className="sm:col-span-3" autoFocus />
        {plan || dealership ? (
          <div className="grid content-end gap-1 sm:col-span-3">
            <span className="text-sm font-medium">Available to</span>
            <span className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm">{owner ?? `${dealership?.name} only`}</span>
          </div>
        ) : (
          <SelectField
            control={form.control}
            name="dealershipId"
            label="Available to"
            className="sm:col-span-3"
            options={[{ value: "", label: "All dealerships (public)" }, ...(dealerships ?? []).map((d) => ({ value: d.id, label: `${d.name} only` }))]}
          />
        )}
        <TextField control={form.control} name="description" label="Tagline" optional placeholder="Hire purchase at scale" className="sm:col-span-6" />
        <MoneyField
          control={form.control}
          name="price"
          label="Price"
          className="sm:col-span-2"
          description={priceChanged ? "New checkouts get the new price; existing subscribers keep theirs." : undefined}
        />
        <SelectField
          control={form.control}
          name="currency"
          label="Currency"
          className="sm:col-span-2"
          options={[
            { value: "kes", label: "KES" },
            { value: "usd", label: "USD" },
            { value: "eur", label: "EUR" },
            { value: "gbp", label: "GBP" },
          ]}
        />
        <SelectField
          control={form.control}
          name="interval"
          label="Billed"
          className="sm:col-span-2"
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly" },
          ]}
        />
        <Controller
          control={form.control}
          name="features"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="sm:col-span-6">
              <FieldLabel htmlFor={featuresId}>Features</FieldLabel>
              <Textarea id={featuresId} {...field} rows={4} placeholder={"Unlimited customers\nHire purchase ledger\nPriority support"} />
              <FieldDescription>One per line, shown as a checklist.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <SwitchField
          control={form.control}
          name="isActive"
          label="Available for new subscriptions"
          description="Turn off to retire a plan. Existing subscribers are unaffected."
          className="sm:col-span-6"
        />
      </FieldGroup>
    </FormDialog>
  )
}
