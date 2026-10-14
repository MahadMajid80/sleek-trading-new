"use client"

import { Landmark, Plus } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { DataTableEmpty } from "@/components/data-table/data-table-empty"
import { PageHeader } from "@/components/page-header"
import { RowActions } from "@/components/row-actions"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api-client"
import { useDialogStore } from "@/stores/dialog-store"

import { bankAccountsResource } from "./queries"
import type { BankAccountRow } from "./schema"

const ALL = { page: 1, perPage: 100, sort: "title.asc", q: "" }

export function BankAccountsView() {
  const query = bankAccountsResource.useList(ALL)
  const remove = bankAccountsResource.useDelete()
  const openDialog = useDialogStore((state) => state.open)
  const confirm = useConfirmState<BankAccountRow>()
  const accounts = query.data?.rows ?? []

  const confirmDelete = () => {
    const account = confirm.item
    if (!account) return
    confirm.onOpenChange(false)
    remove.mutate(account.id, {
      onSuccess: () => toast.success("Bank account deleted", { description: account.title }),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete bank account"),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bank accounts"
        description="Where customers pay deposits and installments. Shown on agreements and invoices."
        actions={
          <Button size="lg" onClick={() => openDialog({ type: "bank-account-form" })}>
            <Plus data-icon="inline-start" />
            Add account
          </Button>
        }
      />

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <DataTableEmpty
            error={query.error}
            onRetry={() => void query.refetch()}
            search=""
            onClearSearch={() => {}}
            searchHint=""
            icon={Landmark}
            title="No bank accounts yet"
            description="Add the accounts customers pay into so they can be selected on agreements and invoices."
            addLabel="Add account"
            onAdd={() => openDialog({ type: "bank-account-form" })}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="group/row relative cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => openDialog({ type: "bank-account-form", account })}
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-gold-light via-brand-gold to-brand-gold-deep"
              />
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-accent-foreground">
                  <Landmark className="size-5" />
                </div>
                <CardAction>
                  <RowActions
                    label={account.title}
                    onEdit={() => openDialog({ type: "bank-account-form", account })}
                    onDelete={() => confirm.request(account)}
                    copy={{ label: "Account number", value: account.accountNumber }}
                  />
                </CardAction>
                <CardTitle className="pt-2">{account.title}</CardTitle>
                <CardDescription>
                  {account.bankName}
                  {account.branchName && ` · ${account.branchName}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-lg tracking-wider tabular-nums">{account.accountNumber}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirm.open}
        onOpenChange={confirm.onOpenChange}
        title={`Delete ${confirm.item?.title ?? "account"}?`}
        description="Accounts already used on agreements or invoices can't be deleted."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
