"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FilePlus2, PencilLine } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { EntityPickerField } from "@/components/form/entity-picker"
import { MoneyField, SelectField } from "@/components/form/fields"
import { FormDialog } from "@/components/form/form-dialog"
import { FieldGroup } from "@/components/ui/field"
import { bankAccountsResource } from "@/features/bank-accounts/queries"
import { bankAccountLabel } from "@/features/bank-accounts/schema"
import { formatKES } from "@/lib/format"

import { useSaveInvoice, type InvoiceRow } from "./queries"
import { emptyInvoice, formatInvoiceNumber, invoiceKindMeta, invoiceSchema, type InvoiceFormValues, type InvoiceKind } from "./schema"

const ALL_ACCOUNTS = { page: 1, perPage: 100, sort: "title.asc", q: "" }

export function InvoiceFormDialog({
  kind,
  invoice,
  open,
  onOpenChange,
}: {
  kind: InvoiceKind
  invoice?: InvoiceRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = Boolean(invoice)
  const meta = invoiceKindMeta[kind]
  const save = useSaveInvoice(kind)
  const accounts = bankAccountsResource.useList(ALL_ACCOUNTS)
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: invoice
      ? {
          customerId: invoice.customerId,
          carId: invoice.carId,
          bankAccountId: invoice.bankAccountId ?? "",
          agreedPrice: String(Math.round(invoice.agreedPrice)),
          deposit: String(Math.round(invoice.deposit)),
          status: invoice.status,
        }
      : emptyInvoice,
    mode: "onTouched",
  })
  const values = useWatch({ control: form.control })
  const balance = Math.max(0, Number(values.agreedPrice || 0) - Number(values.deposit || 0))

  const onSubmit = form.handleSubmit(async () => {
    try {
      const saved = await save.mutateAsync({ id: invoice?.id, values: form.getValues() })
      toast.success(isEdit ? `${meta.singular} updated` : `${meta.singular} created`, {
        description:
          kind === "proforma" && !isEdit && values.status === "live"
            ? `${formatInvoiceNumber(kind, saved.number)} is live and its final invoice was issued`
            : formatInvoiceNumber(kind, saved.number),
      })
      onOpenChange(false)
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={isEdit ? PencilLine : FilePlus2}
      title={isEdit ? `Edit ${formatInvoiceNumber(kind, invoice!.number)}` : `New ${meta.singular.toLowerCase()}`}
      description={
        kind === "proforma"
          ? "A quote for the customer. Mark it live when they commit — that issues the final invoice."
          : "The invoice for a completed sale."
      }
      submitLabel={isEdit ? "Save changes" : `Create ${kind === "proforma" ? "proforma" : "invoice"}`}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <EntityPickerField
          control={form.control}
          name="customerId"
          kind="customer"
          label="Customer"
          initialOption={invoice ? { id: invoice.customerId, title: invoice.customerName, subtitle: invoice.customerPhone } : null}
        />
        <EntityPickerField
          control={form.control}
          name="carId"
          kind="car"
          label="Vehicle"
          initialOption={invoice ? { id: invoice.carId, title: invoice.carTitle, subtitle: invoice.carRegNo ?? "" } : null}
        />
        <MoneyField control={form.control} name="agreedPrice" label="Agreed price" />
        <MoneyField control={form.control} name="deposit" label="Deposit" optional />
        <SelectField
          control={form.control}
          name="bankAccountId"
          label="Pay into account"
          className="sm:col-span-2"
          options={(accounts.data?.rows ?? []).map((account) => ({
            value: account.id,
            label: `${account.title} — ${bankAccountLabel(account)}`,
          }))}
        />
        {kind === "proforma" && !isEdit && (
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            options={[
              { value: "draft", label: "Draft — just a quote for now" },
              { value: "live", label: "Live — also issue the final invoice" },
            ]}
          />
        )}
        <div className="flex items-end justify-between rounded-lg border bg-muted/40 px-3 py-2.5 sm:col-span-2">
          <span className="text-sm text-muted-foreground">Balance</span>
          <span className="text-lg font-semibold tabular-nums">{formatKES(balance)}</span>
        </div>
      </FieldGroup>
    </FormDialog>
  )
}
