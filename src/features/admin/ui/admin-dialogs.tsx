"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { Building2, CarFront, Check, Copy, FileText, KeyRound, PencilLine, Users } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { create } from "zustand"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { SelectField } from "@/components/form/fields"
import { FormDialog } from "@/components/form/form-dialog"
import { TextField } from "@/components/form/text-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { AgreementDetailData } from "@/features/agreements/queries"
import { agreementTypeMeta, formatAgreementNumber } from "@/features/agreements/schema"
import { amountDue, remainingAmount, statusMeta } from "@/features/installments/ledger"
import { apiFetch } from "@/lib/api-client"
import { COUNTRY_OPTIONS } from "@/lib/countries"
import { formatKES } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useCreateDealership, useUpdateDealership, type AdminDealership, type IssuedCredentials } from "../queries"
import { DealershipChip } from "./dealership-chip"

type AdminDialog =
  | { type: "dealership"; dealership?: AdminDealership }
  | { type: "agreement"; id: string }
  /** Login details for a newly created or reset dealership admin. Shown once. */
  | { type: "credentials"; credentials: IssuedCredentials; heading: string }

export const useAdminDialog = create<{
  dialog: AdminDialog | null
  isOpen: boolean
  session: number
  open: (dialog: AdminDialog) => void
  close: () => void
}>()((set) => ({
  dialog: null,
  isOpen: false,
  session: 0,
  open: (dialog) => set((state) => ({ dialog, isOpen: true, session: state.session + 1 })),
  close: () => set({ isOpen: false }),
}))

export function AdminDialogHost() {
  const { dialog, isOpen, session, close } = useAdminDialog()
  const onOpenChange = (open: boolean) => !open && close()
  if (dialog?.type === "dealership")
    return <DealershipFormDialog key={session} dealership={dialog.dealership} open={isOpen} onOpenChange={onOpenChange} />
  if (dialog?.type === "agreement") return <AgreementDrawer key={session} id={dialog.id} open={isOpen} onOpenChange={onOpenChange} />
  if (dialog?.type === "credentials")
    return <CredentialsDialog key={session} heading={dialog.heading} credentials={dialog.credentials} open={isOpen} onOpenChange={onOpenChange} />
  return null
}

// ─── Dealership form ─────────────────────────────────────────────────────────────────────────────────────────────────

const dealershipFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the dealership name").max(80),
  country: z.string().min(1, "Choose a country"),
  city: z.string().trim().min(2, "Enter the city").max(40),
  phone: z.union([z.literal(""), z.string().trim().regex(/^\+?\d{9,14}$/, "Enter a valid phone number")]),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  status: z.enum(["active", "suspended"]),
  managerName: z.string().trim().max(80),
  managerEmail: z.string().trim().max(120),
})
type DealershipFormValues = z.input<typeof dealershipFormSchema>

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
]

function DealershipFormDialog({
  dealership,
  open,
  onOpenChange,
}: {
  dealership?: AdminDealership
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = Boolean(dealership)
  const create = useCreateDealership()
  const update = useUpdateDealership()
  const openDialog = useAdminDialog((state) => state.open)
  const form = useForm<DealershipFormValues>({
    resolver: zodResolver(
      // The first admin is only asked for when creating.
      dealershipFormSchema.superRefine((values, ctx) => {
        if (isEdit) return
        // Contact details are required for a new dealership (optional when editing an existing one).
        if (!/^\+?\d{9,14}$/.test(values.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: values.phone ? "Enter a valid phone number" : "Enter the phone number" })
        if (!z.email().safeParse(values.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: values.email ? "Enter a valid email" : "Enter the email address" })
        if (values.managerName.length < 2) ctx.addIssue({ code: "custom", path: ["managerName"], message: "Enter the admin's name" })
        if (!z.email().safeParse(values.managerEmail).success) ctx.addIssue({ code: "custom", path: ["managerEmail"], message: "Enter a valid email" })
      }),
    ),
    defaultValues: dealership
      ? {
          name: dealership.name,
          country: dealership.country,
          city: dealership.city,
          phone: dealership.phone ?? "",
          email: dealership.email ?? "",
          status: dealership.status,
          managerName: "",
          managerEmail: "",
        }
      : { name: "", country: "KE", city: "", phone: "", email: "", status: "active", managerName: "", managerEmail: "" },
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (dealership) {
        const { managerName: _name, managerEmail: _email, ...rest } = values
        void _name
        void _email
        await update.mutateAsync({ id: dealership.id, values: rest })
        toast.success("Dealership updated", { description: values.name })
        onOpenChange(false)
        return
      }
      const result = await create.mutateAsync(values)
      toast.success("Dealership created", { description: result.dealership.name })
      // Hand the new admin's one-time password to the super admin.
      openDialog({ type: "credentials", heading: `${result.dealership.name} is ready`, credentials: result.credentials })
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={isEdit ? PencilLine : Building2}
      title={isEdit ? `Edit ${dealership!.name}` : "New dealership"}
      description={
        isEdit
          ? "Branding, plan and admins are managed on the dealership's own page."
          : "Creates the dealership and its first admin, who signs in to manage it."
      }
      submitLabel={isEdit ? "Save changes" : "Create dealership"}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField control={form.control} name="name" label="Dealership name" placeholder="Sleek Motors Nairobi" className="sm:col-span-2" autoFocus />
        <SelectField control={form.control} name="country" label="Country" options={COUNTRY_OPTIONS} />
        <TextField control={form.control} name="city" label="City" placeholder="Nairobi" />
        <TextField control={form.control} name="phone" label="Phone" optional={isEdit} placeholder="0712000200" inputMode="tel" />
        <TextField control={form.control} name="email" label="Email" optional={isEdit} placeholder="branch@example.com" type="email" />
        <SelectField control={form.control} name="status" label="Status" options={STATUS_OPTIONS} className={isEdit ? "sm:col-span-2" : undefined} />
        {!isEdit && (
          <>
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold">Dealership admin</p>
              <p className="text-xs text-muted-foreground">The person who signs in to run this dealership. A temporary password is generated and shown once.</p>
            </div>
            <TextField control={form.control} name="managerName" label="Admin's name" placeholder="Jane Wanjiru" autoComplete="off" />
            <TextField control={form.control} name="managerEmail" label="Admin's email" placeholder="jane@example.com" type="email" autoComplete="off" />
          </>
        )}
      </FieldGroup>
    </FormDialog>
  )
}

// ─── One-time credentials ────────────────────────────────────────────────────────────────────────────────────────────

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("truncate text-base font-semibold select-all", mono && "font-mono tracking-wide")}>{value}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
      >
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

function CredentialsDialog({
  heading,
  credentials,
  open,
  onOpenChange,
}: {
  heading: string
  credentials: IssuedCredentials
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            {heading}
          </DialogTitle>
          <DialogDescription>Share these login details with the dealership admin securely.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <CopyRow label="Email" value={credentials.email} />
          <CopyRow label="Temporary password" value={credentials.temporaryPassword} mono />
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            This password is shown only now and can&apos;t be looked up later. If it&apos;s lost, reset it from the dealership&apos;s Admins tab. They&apos;ll be asked to choose their own after signing in.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Agreement drawer ────────────────────────────────────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

function AgreementDrawer({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useQuery({
    queryKey: ["admin", "agreement", id],
    queryFn: ({ signal }) => apiFetch<AgreementDetailData>(`/api/admin/agreements/${id}`, { signal }),
  })
  const a = query.data
  const settled = a?.installments.filter((i) => remainingAmount(i) === 0).length ?? 0
  const outstanding = a?.installments.reduce((sum, i) => sum + remainingAmount(i), 0) ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          {a ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <DealershipChip code={a.dealership.code} />
                <Badge variant="outline">{agreementTypeMeta[a.type].short}</Badge>
              </div>
              <SheetTitle className="font-mono text-xl">{formatAgreementNumber(a.number, a.dealership.code)}</SheetTitle>
              <SheetDescription>
                {a.dealership.name} · created {format(parseISO(a.createdAt), "d MMM yyyy")}
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>Loading agreement…</SheetTitle>
              <SheetDescription className="sr-only">Agreement details</SheetDescription>
            </>
          )}
        </SheetHeader>
        {!a ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Price", formatKES(a.agreedPrice)],
                ["Deposit", formatKES(a.deposit)],
                [a.type === "hire_purchase" ? "Outstanding" : "Balance", formatKES(a.type === "hire_purchase" ? outstanding : a.balance)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-heading text-base font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-accent-foreground" />
                Parties
              </h3>
              <div className="divide-y rounded-xl border px-3">
                {(
                  [
                    ["Buyer", a.buyer],
                    ["Seller", a.seller],
                    ["Witness", a.witness],
                    ["Next of kin", a.nextOfKin],
                  ] as const
                ).map(([role, party]) => (
                  <Row key={role} label={role}>
                    {party ? (
                      <span className="grid">
                        {party.name}
                        <span className="font-mono text-xs font-normal text-muted-foreground">{party.telephone}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </Row>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <CarFront className="size-4 text-accent-foreground" />
                Vehicle
              </h3>
              <div className="divide-y rounded-xl border px-3">
                <Row label="Model">
                  {a.car.year} {a.car.brand} {a.car.name}
                </Row>
                <Row label="Reg / chassis">
                  <span className="font-mono">{a.car.regNo ?? "—"} · {a.car.chassisNo ?? "—"}</span>
                </Row>
                {a.tradeIns.map((t) => (
                  <Row key={t.id} label="Trade-in">
                    {t.car.brand} {t.car.name} · {formatKES(t.amount)}
                  </Row>
                ))}
              </div>
            </section>

            {a.installments.length > 0 && (
              <section className="grid gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-accent-foreground" />
                  Schedule · {settled}/{a.installments.length} settled
                </h3>
                <Progress value={(settled / a.installments.length) * 100} className="h-1.5" />
                <div className="divide-y rounded-xl border">
                  {a.installments.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-5 text-muted-foreground tabular-nums">{i.sequence}</span>
                      <span className="w-24">{format(parseISO(i.dueDate), "d MMM yyyy")}</span>
                      <span className="flex-1 text-right tabular-nums">{formatKES(amountDue(i))}</span>
                      <Badge variant="outline" className={cn("w-28 justify-center", statusMeta[i.status].className)}>
                        {i.status === "paid" && <Check />}
                        {statusMeta[i.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {a.payments.length > 0 && (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Payments · {a.payments.length}</h3>
                <div className="divide-y rounded-xl border">
                  {a.payments.map((p) => (
                    <a
                      key={p.id}
                      href={`/api/admin/payments/${p.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span>
                        {format(parseISO(p.paidOn), "d MMM yyyy")}
                        <span className="text-muted-foreground"> · installment #{p.installmentSequence}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatKES(p.amount)}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
