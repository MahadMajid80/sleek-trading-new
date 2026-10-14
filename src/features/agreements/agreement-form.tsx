"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { ArrowLeftRight, CarFront, FileSignature, Info, Lock, Plus, Save, Scale, Trash2, Users } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, type ReactNode } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { EntityPickerField, type PickerOption } from "@/components/form/entity-picker"
import { DateField, MoneyField, SelectField, SwitchField } from "@/components/form/fields"
import { TextField } from "@/components/form/text-field"
import { ModKey } from "@/components/mod-key"
import { useDealership } from "@/components/shell/dealership-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { bankAccountsResource } from "@/features/bank-accounts/queries"
import { bankAccountLabel } from "@/features/bank-accounts/schema"
import { buildSchedule } from "@/features/installments/ledger"
import { formatKES } from "@/lib/format"

import { useSaveAgreement, type AgreementDetailData } from "./queries"
import {
  AGREEMENT_TYPES,
  agreementSchema,
  agreementTypeMeta,
  balanceOf,
  emptyAgreement,
  formatAgreementNumber,
  PAYMENT_METHODS,
  type AgreementFormValues,
  type AgreementInput,
  type AgreementType,
} from "./schema"

const ALL_ACCOUNTS = { page: 1, perPage: 100, sort: "title.asc", q: "" }

const customerOption = (c: AgreementDetailData["buyer"]): PickerOption | null =>
  c ? { id: c.id, title: c.name, subtitle: `${c.telephone} · ID ${c.nationalId}` } : null
const carOption = (c: AgreementDetailData["car"]): PickerOption => ({
  id: c.id,
  title: `${c.year} ${c.brand} ${c.name}`,
  subtitle: [c.regNo, c.chassisNo && `Chassis ${c.chassisNo}`, c.color].filter(Boolean).join(" · "),
})

export function toAgreementFormValues(a: AgreementDetailData): AgreementFormValues {
  const money = (value: number | null) => (value == null ? "" : String(Math.round(value)))
  return {
    type: a.type,
    customerId: a.customerId ?? "",
    sellerId: a.sellerId ?? "",
    witnessId: a.witnessId ?? "",
    nextOfKinId: a.nextOfKinId ?? "",
    carId: a.carId,
    bankAccountId: a.bankAccountId ?? "",
    agreedPrice: money(a.agreedPrice),
    deposit: money(a.deposit),
    remainingDepositPaymentMethod: (a.remainingDepositPaymentMethod as AgreementFormValues["remainingDepositPaymentMethod"]) ?? "",
    paybill: a.paybill ?? "",
    physicalLogbook: a.physicalLogbook,
    transferLogbook: a.transferLogbook,
    uponPayment: a.uponPayment,
    tradeIns: a.tradeIns.map((t) => ({ carId: t.car.id, amount: money(t.amount) })),
    installmentFrequency: a.installmentFrequency ?? "",
    installmentDuration: a.installmentDuration ? String(a.installmentDuration) : "",
    startingDate: a.startingDate ?? "",
    hasTracker: a.hasTracker,
    trackerFee: money(a.trackerFee),
    trackerDuration: a.trackerDuration ?? "",
    includeAdditionalNotes: a.includeAdditionalNotes,
  }
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Users
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-accent-foreground">
            <Icon className="size-4" />
          </div>
          <div className="grid gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function AgreementForm({ agreement, initialType }: { agreement?: AgreementDetailData; initialType: AgreementType }) {
  const router = useRouter()
  const isEdit = Boolean(agreement)
  const locked = Boolean(agreement && agreement.payments.length > 0)
  const save = useSaveAgreement()
  const { current: dealership } = useDealership()
  const accounts = bankAccountsResource.useList(ALL_ACCOUNTS)

  const form = useForm<AgreementFormValues, unknown, AgreementInput>({
    resolver: zodResolver(agreementSchema),
    defaultValues: agreement ? toAgreementFormValues(agreement) : emptyAgreement(initialType),
    mode: "onTouched",
  })
  const tradeIns = useFieldArray({ control: form.control, name: "tradeIns" })
  const values = useWatch({ control: form.control })
  const type = values.type ?? initialType
  const isHp = type === "hire_purchase"

  const balance = balanceOf({ agreedPrice: values.agreedPrice ?? "", deposit: values.deposit ?? "" })
  const tradeInTotal = (values.tradeIns ?? []).reduce((sum, t) => sum + Number(t?.amount || 0), 0)

  const preview = useMemo(() => {
    const duration = Number(values.installmentDuration || 0)
    if (!isHp || balance <= 0 || duration < 1 || !values.installmentFrequency || !values.startingDate) return null
    const schedule = buildSchedule({
      balance,
      frequency: values.installmentFrequency,
      duration,
      startingDate: values.startingDate,
    })
    return { count: schedule.length, first: schedule[0]!, last: schedule.at(-1)! }
  }, [isHp, balance, values.installmentDuration, values.installmentFrequency, values.startingDate])

  const initialTradeInOptions = new Map(agreement?.tradeIns.map((t) => [t.car.id, carOption(t.car)]))

  const onSubmit = form.handleSubmit(
    async () => {
      try {
        const saved = await save.mutateAsync({ id: agreement?.id, values: form.getValues() })
        toast.success(isEdit ? "Agreement updated" : "Agreement created", { description: formatAgreementNumber(saved.number, dealership.code) })
        router.push(`/agreements/${saved.id}` as Route)
        router.refresh()
      } catch (error) {
        applyServerErrors(error, form.setError)
      }
    },
    () => toast.error("Some details need attention", { description: "Check the highlighted fields." }),
  )

  const accountOptions = (accounts.data?.rows ?? []).map((account) => ({
    value: account.id,
    label: `${account.title} — ${bankAccountLabel(account)}`,
  }))

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.requestSubmit()
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        {locked && (
          <Alert>
            <Lock />
            <AlertTitle>Price and installment terms are locked</AlertTitle>
            <AlertDescription>
              {agreement!.payments.length} payment{agreement!.payments.length === 1 ? " has" : "s have"} been recorded. You can
              still update parties, conditions and paybill. To change the price or schedule, reverse the payments first.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium">Agreement type</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={type}
              onValueChange={(value) => {
                if (!value || locked) return
                form.setValue("type", value as AgreementType, { shouldDirty: true })
                if (value === "hire_purchase") {
                  if (!form.getValues("installmentFrequency")) form.setValue("installmentFrequency", "monthly")
                  if (form.getValues("tradeIns").length > 1) toast.info("Hire purchase allows one trade-in vehicle; remove the extras.")
                }
              }}
              disabled={locked}
              className="grid w-full grid-cols-1 sm:grid-cols-3"
            >
              {AGREEMENT_TYPES.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-auto min-w-0 flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10"
                >
                  <span className="font-medium">{agreementTypeMeta[value].short}</span>
                  <span className="text-xs leading-snug font-normal text-muted-foreground">{agreementTypeMeta[value].description}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardContent>
        </Card>

        <Section icon={Users} title="Parties" description="Everyone named on the agreement. One person can't hold two roles.">
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <EntityPickerField
              control={form.control}
              name="customerId"
              kind="customer"
              label="Buyer"
              optional={type === "buying"}
              description={type === "buying" ? "Leave empty when the dealership is the buyer" : undefined}
              initialOption={agreement ? customerOption(agreement.buyer) : null}
            />
            <EntityPickerField
              control={form.control}
              name="sellerId"
              kind="customer"
              label="Seller"
              optional={type === "hire_purchase"}
              initialOption={agreement ? customerOption(agreement.seller) : null}
            />
            <EntityPickerField
              control={form.control}
              name="witnessId"
              kind="customer"
              label="Witness"
              initialOption={agreement ? customerOption(agreement.witness) : null}
            />
            <EntityPickerField
              control={form.control}
              name="nextOfKinId"
              kind="customer"
              label="Next of kin"
              initialOption={agreement ? customerOption(agreement.nextOfKin) : null}
            />
          </FieldGroup>
        </Section>

        <Section icon={CarFront} title="Vehicle" description="The vehicle on this agreement, plus any vehicles traded in.">
          <FieldGroup className="gap-5">
            <EntityPickerField
              control={form.control}
              name="carId"
              kind="car"
              label={type === "buying" ? "Vehicle being bought" : "Vehicle being sold"}
              initialOption={agreement ? carOption(agreement.car) : null}
            />
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ArrowLeftRight className="size-4 text-muted-foreground" />
                  Trade-ins
                </p>
                <p className="text-sm text-muted-foreground">
                  {isHp ? "Up to one vehicle the customer hands over." : "Vehicles the customer hands over as part of the deal."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => tradeIns.append({ carId: "", amount: "" })}
                disabled={isHp && tradeIns.fields.length >= 1}
              >
                <Plus data-icon="inline-start" />
                Add trade-in
              </Button>
            </div>
            {tradeIns.fields.map((item, index) => (
              <div key={item.id} className="grid items-start gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <EntityPickerField
                  control={form.control}
                  name={`tradeIns.${index}.carId`}
                  kind="car"
                  label={`Trade-in vehicle ${tradeIns.fields.length > 1 ? index + 1 : ""}`}
                  initialOption={initialTradeInOptions.get(form.getValues(`tradeIns.${index}.carId`)) ?? null}
                />
                <MoneyField control={form.control} name={`tradeIns.${index}.amount`} label="Value" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6 text-muted-foreground hover:text-destructive"
                  onClick={() => tradeIns.remove(index)}
                  aria-label="Remove trade-in"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <FieldError errors={[form.formState.errors.tradeIns?.root ?? (form.formState.errors.tradeIns as { message?: string })]} />
          </FieldGroup>
        </Section>

        <Section icon={Scale} title="Price & payment" description="The balance is the agreed price minus the deposit.">
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <MoneyField control={form.control} name="agreedPrice" label="Agreed price" />
            <MoneyField control={form.control} name="deposit" label="Deposit" optional={type !== "hire_purchase"} />
            <SelectField
              control={form.control}
              name="bankAccountId"
              label="Pay into account"
              options={accountOptions}
              placeholder={accounts.isPending ? "Loading accounts…" : "Select account"}
            />
            <SelectField
              control={form.control}
              name="remainingDepositPaymentMethod"
              label="Remaining deposit paid by"
              optional
              options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
            />
            <TextField control={form.control} name="paybill" label="Paybill" optional placeholder="e.g. 247247" />
          </FieldGroup>
        </Section>

        {isHp && (
          <Section icon={FileSignature} title="Hire purchase terms" description="These generate the installment schedule.">
            <FieldGroup className="grid gap-5 sm:grid-cols-3">
              <SelectField
                control={form.control}
                name="installmentFrequency"
                label="Duration in"
                options={[
                  { value: "monthly", label: "Months" },
                  { value: "yearly", label: "Years" },
                ]}
              />
              <TextField
                control={form.control}
                name="installmentDuration"
                label={values.installmentFrequency === "yearly" ? "Number of years" : "Number of months"}
                inputMode="numeric"
                maxLength={3}
                sanitize={(value) => value.replace(/\D/g, "")}
                placeholder="12"
              />
              <DateField control={form.control} name="startingDate" label="First installment due" />
            </FieldGroup>
            <Separator className="my-5" />
            <FieldGroup className="gap-4">
              <SwitchField control={form.control} name="hasTracker" label="Tracker" description="Charge a tracker fee on this agreement." />
              {values.hasTracker && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <MoneyField control={form.control} name="trackerFee" label="Tracker fee" />
                  <TextField control={form.control} name="trackerDuration" label="Fee covers" placeholder="e.g. 1 year" />
                </div>
              )}
              <SwitchField
                control={form.control}
                name="includeAdditionalNotes"
                label="Additional notes"
                description="Include the additional notes clause in the printed agreement."
              />
            </FieldGroup>
          </Section>
        )}

        <Section icon={Info} title="Conditions" description="Printed as ticked or unticked on the agreement.">
          <FieldGroup className="grid gap-3 sm:grid-cols-3">
            <SwitchField control={form.control} name="physicalLogbook" label="Physical logbook" />
            <SwitchField control={form.control} name="transferLogbook" label="Transfer logbook" />
            <SwitchField control={form.control} name="uponPayment" label="Upon payment" />
          </FieldGroup>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card className="overflow-hidden">
          <div aria-hidden className="h-1 bg-linear-to-r from-brand-gold-light via-brand-gold to-brand-gold-deep" />
          <CardHeader>
            <CardDescription>{isEdit ? formatAgreementNumber(agreement!.number, agreement!.dealership.code) : "New agreement"}</CardDescription>
            <CardTitle>{agreementTypeMeta[type].label}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Agreed price</dt>
                <dd className="font-medium tabular-nums">{formatKES(Number(values.agreedPrice || 0))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Deposit</dt>
                <dd className="tabular-nums">− {formatKES(Number(values.deposit || 0))}</dd>
              </div>
              {tradeInTotal > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Trade-in value</dt>
                  <dd className="tabular-nums">{formatKES(tradeInTotal)}</dd>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-medium">Balance</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatKES(balance)}</dd>
              </div>
            </dl>
            {isHp && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                {preview ? (
                  <>
                    <p className="font-medium">
                      {preview.count} × {formatKES(preview.first.amount)}
                    </p>
                    <p className="text-muted-foreground">
                      {format(parseISO(preview.first.dueDate), "d MMM yyyy")} → {format(parseISO(preview.last.dueDate), "d MMM yyyy")}
                      {preview.last.amount !== preview.first.amount && ` · last ${formatKES(preview.last.amount)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Enter the price, deposit and terms to preview the schedule.</p>
                )}
              </div>
            )}
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {isEdit ? "Save changes" : "Create agreement"}
            </Button>
            <Button type="button" variant="ghost" asChild className="w-full">
              <Link href={(agreement ? `/agreements/${agreement.id}` : "/agreements") as Route}>Cancel</Link>
            </Button>
            <p className="hidden items-center justify-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <KbdGroup>
                <Kbd>
                  <ModKey />
                </Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              to save
            </p>
          </CardContent>
        </Card>
      </aside>
    </form>
  )
}
