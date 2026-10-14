"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { UserPen, UserPlus } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { FormDialog } from "@/components/form/form-dialog"
import { digitsOnly, TextField } from "@/components/form/text-field"
import { FieldGroup } from "@/components/ui/field"

import { customersResource } from "./queries"
import { customerSchema, emptyCustomer, toCustomerFormValues, type CustomerFormValues, type CustomerRow } from "./schema"

export function CustomerFormDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer?: CustomerRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = Boolean(customer)
  const save = customersResource.useSave()
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer ? toCustomerFormValues(customer) : emptyCustomer,
    mode: "onTouched",
  })

  // Send the raw inputs; the API validates them against the same schema.
  const onSubmit = form.handleSubmit(async () => {
    try {
      const saved = await save.mutateAsync({ id: customer?.id, values: form.getValues() })
      toast.success(isEdit ? "Customer updated" : "Customer added", { description: saved.name })
      onOpenChange(false)
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={isEdit ? UserPen : UserPlus}
      title={isEdit ? "Edit customer" : "Add customer"}
      description={isEdit ? "Update this customer's details." : "Buyers, sellers, witnesses and next of kin are all customers."}
      submitLabel={isEdit ? "Save changes" : "Add customer"}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Full name"
          placeholder="e.g. Wanjiku Kamau"
          autoComplete="name"
          autoFocus
          className="sm:col-span-2"
        />
        <TextField
          control={form.control}
          name="nationalId"
          label="National ID"
          placeholder="12345678"
          inputMode="numeric"
          maxLength={8}
          sanitize={digitsOnly}
        />
        <TextField
          control={form.control}
          name="kraPin"
          label="KRA PIN"
          placeholder="A012345678X"
          maxLength={11}
          sanitize={(value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")}
        />
        <TextField
          control={form.control}
          name="telephone"
          label="Phone number"
          placeholder="0712345678"
          inputMode="tel"
          autoComplete="tel"
          maxLength={15}
          sanitize={(value) => value.replace(/[^\d+]/g, "")}
        />
        <TextField
          control={form.control}
          name="email"
          label="Email"
          optional
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
        />
        <TextField control={form.control} name="poBox" label="P.O. Box" optional placeholder="99-40301" maxLength={15} />
      </FieldGroup>
    </FormDialog>
  )
}
