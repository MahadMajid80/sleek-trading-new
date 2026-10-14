"use client"

import { BankAccountFormDialog } from "@/features/bank-accounts/bank-account-form-dialog"
import { CarFormDialog } from "@/features/cars/car-form-dialog"
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog"
import { InvoiceFormDialog } from "@/features/invoices/invoice-form-dialog"
import { useDialogStore } from "@/stores/dialog-store"

export function DialogHost() {
  const { dialog, isOpen, session, close } = useDialogStore()
  const onOpenChange = (open: boolean) => !open && close()

  switch (dialog?.type) {
    case "customer-form":
      return <CustomerFormDialog key={session} customer={dialog.customer} open={isOpen} onOpenChange={onOpenChange} />
    case "car-form":
      return <CarFormDialog key={session} car={dialog.car} open={isOpen} onOpenChange={onOpenChange} />
    case "bank-account-form":
      return <BankAccountFormDialog key={session} account={dialog.account} open={isOpen} onOpenChange={onOpenChange} />
    case "invoice-form":
      return (
        <InvoiceFormDialog key={session} kind={dialog.kind} invoice={dialog.invoice} open={isOpen} onOpenChange={onOpenChange} />
      )
    default:
      return null
  }
}
