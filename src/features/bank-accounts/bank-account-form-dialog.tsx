"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Landmark, PencilLine } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { FormDialog } from "@/components/form/form-dialog"
import { TextField } from "@/components/form/text-field"
import { FieldGroup } from "@/components/ui/field"

import { bankAccountsResource } from "./queries"
import {
  bankAccountSchema,
  emptyBankAccount,
  toBankAccountFormValues,
  type BankAccountFormValues,
  type BankAccountRow,
} from "./schema"

const BANKS = ["Equity Bank", "KCB Bank", "Co-operative Bank", "NCBA Bank", "Absa Bank Kenya", "Stanbic Bank", "Standard Chartered", "I&M Bank", "Family Bank", "DTB", "Mpesa Paybill"]

export function BankAccountFormDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: BankAccountRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = Boolean(account)
  const save = bankAccountsResource.useSave()
  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: account ? toBankAccountFormValues(account) : emptyBankAccount,
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async () => {
    try {
      const saved = await save.mutateAsync({ id: account?.id, values: form.getValues() })
      toast.success(isEdit ? "Bank account updated" : "Bank account added", { description: saved.title })
      onOpenChange(false)
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={isEdit ? PencilLine : Landmark}
      title={isEdit ? "Edit bank account" : "Add bank account"}
      description="Accounts customers pay into. They appear on agreements and invoices."
      submitLabel={isEdit ? "Save changes" : "Add account"}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <datalist id="kenyan-banks">
        {BANKS.map((bank) => (
          <option key={bank} value={bank} />
        ))}
      </datalist>
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="title"
          label="Account title"
          placeholder="Your business name — Collections"
          autoFocus
          className="sm:col-span-2"
        />
        <TextField control={form.control} name="bankName" label="Bank" placeholder="Equity Bank" list="kenyan-banks" />
        <TextField control={form.control} name="branchName" label="Branch" optional placeholder="Nakuru" />
        <TextField
          control={form.control}
          name="accountNumber"
          label="Account number"
          placeholder="0180291234567"
          className="sm:col-span-2"
        />
      </FieldGroup>
    </FormDialog>
  )
}
