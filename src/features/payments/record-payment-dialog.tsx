"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { ArrowRight, FileCheck2, Paperclip, Wallet, X } from "lucide-react"
import { useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { DateField, MoneyField, SelectField, SwitchField } from "@/components/form/fields"
import { FormDialog } from "@/components/form/form-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useRecordPayment, type AgreementDetailData } from "@/features/agreements/queries"
import { PaymentPlanError, planPayment, remainingAmount, todayISO } from "@/features/installments/ledger"
import { formatKES } from "@/lib/format"

const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]

const schema = z.object({
  installmentId: z.string().min(1, "Choose the installment"),
  amount: z.string().regex(/^\d+$/, "Enter the amount received").refine((v) => Number(v) > 0, "Enter the amount received"),
  paidOn: z.iso.date("Pick the payment date"),
  notes: z.string().max(500),
  carryShortfall: z.boolean(),
  receipt: z
    .instanceof(File, { message: "Attach the receipt (PDF or photo)" })
    .refine((file) => RECEIPT_TYPES.includes(file.type), "Receipt must be a PDF, JPG, PNG or WEBP")
    .refine((file) => file.size <= 5 * 1024 * 1024, "Receipt must be smaller than 5 MB"),
})

type Values = z.input<typeof schema>

export function RecordPaymentDialog({
  agreement,
  installmentId,
  open,
  onOpenChange,
}: {
  agreement: AgreementDetailData
  installmentId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const record = useRecordPayment(agreement.id)
  const openInstallments = agreement.installments.filter((i) => remainingAmount(i) > 0)
  const initial = agreement.installments.find((i) => i.id === installmentId) ?? openInstallments[0]

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      installmentId: initial?.id ?? "",
      amount: initial ? String(Math.round(remainingAmount(initial))) : "",
      paidOn: todayISO(),
      notes: "",
      carryShortfall: true,
      receipt: undefined as unknown as File,
    },
    mode: "onTouched",
  })
  const values = useWatch({ control: form.control })
  const target = agreement.installments.find((i) => i.id === values.installmentId)
  const nextSequence = target ? agreement.installments.find((i) => i.sequence === target.sequence + 1) : undefined

  const preview = useMemo(() => {
    const amount = Number(values.amount || 0)
    if (!values.installmentId || amount <= 0) return null
    try {
      return { plan: planPayment(agreement.installments, values.installmentId, amount, Boolean(values.carryShortfall)) }
    } catch (error) {
      return { error: error instanceof PaymentPlanError ? error.message : "Invalid amount" }
    }
  }, [agreement.installments, values.installmentId, values.amount, values.carryShortfall])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const plan = await record.mutateAsync({
        installmentId: data.installmentId,
        amount: data.amount,
        paidOn: data.paidOn,
        notes: data.notes,
        carryShortfall: data.carryShortfall,
        receipt: data.receipt,
      })
      const extras = [
        plan.paidAhead > 0 && `${formatKES(plan.paidAhead)} paid ahead`,
        plan.carried > 0 && `${formatKES(plan.carried)} carried to the next installment`,
      ].filter(Boolean)
      toast.success(`${formatKES(Number(data.amount))} recorded`, { description: extras.join(" · ") || undefined })
      onOpenChange(false)
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Wallet}
      title="Record payment"
      description={`Installment payment for ${agreement.buyer?.name ?? "the customer"}.`}
      submitLabel="Record payment"
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <FieldGroup className="gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="installmentId"
            label="Installment"
            options={openInstallments.map((i) => ({
              value: i.id,
              label: `#${i.sequence} · due ${format(parseISO(i.dueDate), "d MMM yyyy")} · ${formatKES(remainingAmount(i))}`,
            }))}
          />
          <MoneyField control={form.control} name="amount" label="Amount received" />
          <DateField control={form.control} name="paidOn" label="Paid on" />
          <Controller
            control={form.control}
            name="receipt"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="receipt-input">Receipt</FieldLabel>
                {field.value ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-sm">
                    <FileCheck2 className="size-4 shrink-0 text-success" />
                    <span className="truncate">{field.value.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto"
                      onClick={() => field.onChange(undefined)}
                      aria-label="Remove receipt"
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="receipt-input"
                    className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    <Paperclip className="size-4" />
                    Attach M-Pesa / bank receipt
                  </label>
                )}
                <input
                  id="receipt-input"
                  ref={field.ref}
                  type="file"
                  accept={RECEIPT_TYPES.join(",")}
                  className="sr-only"
                  onChange={(event) => {
                    field.onChange(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                <FieldDescription>PDF or photo, up to 5 MB</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        {preview && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
            {"error" in preview ? (
              <p className="text-destructive">{preview.error}</p>
            ) : (
              <ul className="grid gap-1.5">
                <li className="flex items-center gap-2">
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span>
                    <strong className="tabular-nums">{formatKES(preview.plan.toTarget)}</strong> to installment #{target?.sequence}
                  </span>
                </li>
                {preview.plan.paidAhead > 0 && (
                  <li className="flex items-center gap-2 text-success">
                    <ArrowRight className="size-3.5" />
                    <span>
                      <strong className="tabular-nums">{formatKES(preview.plan.paidAhead)}</strong> paid ahead on following installments
                    </span>
                  </li>
                )}
                {preview.plan.carried > 0 && (
                  <li className="flex items-center gap-2 text-warning">
                    <ArrowRight className="size-3.5" />
                    <span>
                      <strong className="tabular-nums">{formatKES(preview.plan.carried)}</strong> short, moved to installment #{nextSequence?.sequence}
                    </span>
                  </li>
                )}
                {preview.plan.leftOwing > 0 && (
                  <li className="flex items-center gap-2 text-warning">
                    <ArrowRight className="size-3.5" />
                    <span>
                      <strong className="tabular-nums">{formatKES(preview.plan.leftOwing)}</strong> stays owing on installment #{target?.sequence}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {nextSequence && preview && !("error" in preview) && (preview.plan.carried > 0 || preview.plan.leftOwing > 0) && (
          <SwitchField
            control={form.control}
            name="carryShortfall"
            label="Carry the shortfall to the next installment"
            description="Off: the unpaid part stays owing on this installment instead."
          />
        )}

        <Controller
          control={form.control}
          name="notes"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="payment-notes">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea id="payment-notes" rows={2} placeholder="e.g. M-Pesa ref QJK4XT2L9P" {...field} />
            </Field>
          )}
        />
      </FieldGroup>
    </FormDialog>
  )
}
