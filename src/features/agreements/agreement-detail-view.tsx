"use client"

import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import {
  ArrowLeft,
  CalendarClock,
  CarFront,
  Check,
  Download,
  FileDown,
  FileText,
  Landmark,
  MoreHorizontal,
  Pencil,
  Receipt,
  Trash2,
  Undo2,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog, useConfirmState } from "@/components/confirm-dialog"
import { Reveal } from "@/components/reveal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadAgreementPdf, downloadStatementPdf } from "@/features/documents/download"
import { amountDue, remainingAmount, statusMeta } from "@/features/installments/ledger"
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog"
import { ApiError } from "@/lib/api-client"
import { formatKES } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  useAgreement,
  useDeleteAgreement,
  useDeleteDocument,
  useReversePayment,
  useUploadDocument,
  type AgreementDetailData,
} from "./queries"
import { agreementTypeMeta, formatAgreementNumber, typeBadgeClass } from "./schema"

type Party = AgreementDetailData["buyer"]

function PartyRow({ role, party, dealershipName }: { role: string; party: Party; dealershipName: string }) {
  return (
    <div className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{role}</span>
      {party ? (
        <>
          <Link
            href={`/customers?q=${encodeURIComponent(party.nationalId)}` as Route}
            className="font-medium underline-offset-4 hover:underline"
          >
            {party.name}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {party.telephone} · ID {party.nationalId} · {party.kraPin}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{role === "Buyer" ? dealershipName : "—"}</span>
      )}
    </div>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: ReactNode; tone?: "danger" | "success" }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="grid gap-1 px-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-xl font-semibold tracking-tight tabular-nums",
            tone === "danger" && "text-destructive",
            tone === "success" && "text-success",
          )}
        >
          {value}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}

function useDownload() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key)
    try {
      await task()
    } catch (error) {
      console.error(error)
      toast.error("Couldn't generate the PDF")
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}

export function AgreementDetailView({ initial }: { initial: AgreementDetailData }) {
  const router = useRouter()
  const { data: agreement = initial } = useAgreement(initial.id, initial)
  const deleteAgreement = useDeleteAgreement()
  const reverse = useReversePayment(agreement.id)
  const upload = useUploadDocument(agreement.id)
  const removeDocument = useDeleteDocument(agreement.id)
  const download = useDownload()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // `?pay=<installmentId>` (from the Installments page) opens the payment dialog straight away.
  const [payParam, setPayParam] = useQueryState("pay")
  const [paymentFor, setPaymentFor] = useState<{ installmentId?: string; session: number } | null>(() =>
    payParam ? { installmentId: payParam, session: 1 } : null,
  )
  const [paymentOpen, setPaymentOpen] = useState(Boolean(payParam))
  useEffect(() => {
    if (payParam) void setPayParam(null, { history: "replace" })
  }, [payParam, setPayParam])
  const reverseConfirm = useConfirmState<AgreementDetailData["payments"][number]>()
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)

  const isHp = agreement.type === "hire_purchase"
  const number = formatAgreementNumber(agreement.number, agreement.dealership.code)
  const paidTotal = agreement.payments.reduce((sum, p) => sum + p.amount, 0)
  const outstanding = agreement.installments.reduce((sum, i) => sum + remainingAmount(i), 0)
  const overdue = agreement.installments.filter((i) => i.status === "overdue")
  const settledCount = agreement.installments.filter((i) => remainingAmount(i) === 0).length
  const nextDue = agreement.installments.find((i) => remainingAmount(i) > 0)
  const completed = isHp && agreement.installments.length > 0 && !nextDue

  const openPayment = (installmentId?: string) => {
    setPaymentFor((current) => ({ installmentId, session: (current?.session ?? 0) + 1 }))
    setPaymentOpen(true)
  }

  const uploadFiles = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      upload.mutate(file, {
        onSuccess: () => toast.success("Document uploaded", { description: file.name }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Upload failed", { description: file.name }),
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <Link
            href={"/agreements" as Route}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Agreements
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{number}</h1>
            <Badge variant="outline" className={typeBadgeClass[agreement.type]}>
              {agreementTypeMeta[agreement.type].short}
            </Badge>
            {isHp &&
              (completed ? (
                <Badge variant="outline" className={statusMeta.paid.className}>
                  Completed
                </Badge>
              ) : overdue.length ? (
                <Badge variant="outline" className={statusMeta.overdue.className}>
                  {overdue.length} overdue
                </Badge>
              ) : (
                <Badge variant="outline">On track</Badge>
              ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {agreement.car.year} {agreement.car.brand} {agreement.car.name}
            {agreement.buyer && ` · ${agreement.buyer.name}`} · created {format(parseISO(agreement.createdAt), "d MMM yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isHp && !completed && (
            <Button size="lg" onClick={() => openPayment()}>
              <Wallet data-icon="inline-start" />
              Record payment
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            disabled={download.busy === "agreement"}
            onClick={() => download.run("agreement", () => downloadAgreementPdf(agreement))}
          >
            {download.busy === "agreement" ? <Spinner data-icon="inline-start" /> : <FileDown data-icon="inline-start" />}
            Agreement PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-lg" variant="outline" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/agreements/${agreement.id}/edit` as Route}>
                  <Pencil />
                  Edit agreement
                </Link>
              </DropdownMenuItem>
              {isHp && (
                <DropdownMenuItem onSelect={() => download.run("statement", () => downloadStatementPdf(agreement))}>
                  <Download />
                  Download statement
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete agreement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Reveal className={cn("grid gap-3 sm:grid-cols-2", isHp ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        <Stat label="Agreed price" value={formatKES(agreement.agreedPrice)} />
        <Stat label="Deposit" value={formatKES(agreement.deposit)} hint={agreement.remainingDepositPaymentMethod ?? undefined} />
        {isHp ? (
          <>
            <Stat label="Paid in installments" value={formatKES(paidTotal)} hint={`${settledCount} of ${agreement.installments.length} settled`} tone={completed ? "success" : undefined} />
            <Stat
              label="Outstanding"
              value={formatKES(outstanding)}
              tone={overdue.length ? "danger" : undefined}
              hint={
                nextDue
                  ? `Next: ${formatKES(remainingAmount(nextDue))} due ${format(parseISO(nextDue.dueDate), "d MMM")}`
                  : "Fully paid"
              }
            />
          </>
        ) : (
          <Stat label="Balance" value={formatKES(agreement.balance)} />
        )}
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {isHp && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-accent-foreground" />
                  Installment schedule
                </CardTitle>
                <CardDescription>
                  {agreement.installments.length} monthly installments from{" "}
                  {agreement.startingDate && format(parseISO(agreement.startingDate), "d MMM yyyy")}
                </CardDescription>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={download.busy === "statement"}
                    onClick={() => download.run("statement", () => downloadStatementPdf(agreement))}
                  >
                    {download.busy === "statement" ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                    Statement
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Progress value={agreement.installments.length ? (settledCount / agreement.installments.length) * 100 : 0} className="h-2" />
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Amount due</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agreement.installments.map((i) => {
                        const due = amountDue(i)
                        const left = remainingAmount(i)
                        return (
                          <TableRow key={i.id} className={cn(i.status === "overdue" && "bg-destructive/[0.03]")}>
                            <TableCell className="text-muted-foreground tabular-nums">{i.sequence}</TableCell>
                            <TableCell className="whitespace-nowrap">{format(parseISO(i.dueDate), "d MMM yyyy")}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatKES(due)}
                              {i.carriedOver > 0 && (
                                <span className="block text-xs text-warning">incl. {formatKES(i.carriedOver)} carried in</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{i.paid ? formatKES(i.paid) : "—"}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{left ? formatKES(left) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusMeta[i.status].className}>
                                {i.status === "paid" && <Check />}
                                {statusMeta[i.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {left > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => openPayment(i.id)}>
                                  Pay
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {isHp && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-4 text-accent-foreground" />
                  Payments
                </CardTitle>
                <CardDescription>
                  {agreement.payments.length
                    ? `${agreement.payments.length} payment${agreement.payments.length === 1 ? "" : "s"} · ${formatKES(paidTotal)} received`
                    : "No payments recorded yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agreement.payments.length === 0 ? (
                  <Empty className="py-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Wallet />
                      </EmptyMedia>
                      <EmptyTitle>No payments yet</EmptyTitle>
                      <EmptyDescription>Record the first installment payment when it comes in.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ul className="divide-y">
                    {(showAllPayments ? agreement.payments : agreement.payments.slice(0, 5)).map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                        <div className="grid min-w-0 flex-1">
                          <span className="font-medium tabular-nums">{formatKES(payment.amount)}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(payment.paidOn), "d MMM yyyy")} · installment #{payment.installmentSequence}
                            {payment.carried > 0 && ` · ${formatKES(payment.carried)} carried forward`}
                            {payment.notes && ` · ${payment.notes}`}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/payments/${payment.id}/receipt?inline=1`} target="_blank" rel="noreferrer">
                            <FileText data-icon="inline-start" />
                            Receipt
                          </a>
                        </Button>
                        {payment.canReverse && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => reverseConfirm.request(payment)}
                          >
                            <Undo2 data-icon="inline-start" />
                            Reverse
                          </Button>
                        )}
                      </li>
                    ))}
                    {agreement.payments.length > 5 && (
                      <li className="pt-3">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllPayments((value) => !value)}>
                          {showAllPayments ? "Show latest 5" : `Show all ${agreement.payments.length} payments`}
                        </Button>
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-accent-foreground" />
                Documents
              </CardTitle>
              <CardDescription>Signed agreements, logbook copies and other files.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  uploadFiles(event.dataTransfer.files)
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/50",
                  dragging && "border-primary bg-accent",
                )}
              >
                {upload.isPending ? <Spinner /> : <Upload className="size-5" />}
                <span className="font-medium text-foreground">Drop files here or click to upload</span>
                <span className="text-xs">PDF, Word, text or images · up to 10 MB each</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="sr-only"
                accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png"
                onChange={(event) => {
                  uploadFiles(event.target.files)
                  event.target.value = ""
                }}
              />
              {agreement.documents.length > 0 && (
                <ul className="divide-y rounded-lg border">
                  {agreement.documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="grid min-w-0 flex-1">
                        <a
                          href={`/api/agreements/${agreement.id}/documents/${document.id}?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {document.fileName}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {document.sizeBytes ? `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB · ` : ""}
                          {formatDistanceToNowStrict(parseISO(document.uploadedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon-sm" asChild aria-label={`Download ${document.fileName}`}>
                        <a href={`/api/agreements/${agreement.id}/documents/${document.id}`}>
                          <Download />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${document.fileName}`}
                        onClick={() =>
                          removeDocument.mutate(document.id, {
                            onSuccess: () => toast.success("Document deleted", { description: document.fileName }),
                          })
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-accent-foreground" />
                Parties
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <PartyRow role="Buyer" party={agreement.buyer} dealershipName={agreement.dealership.name} />
              {(agreement.seller || agreement.type !== "hire_purchase") && <PartyRow role="Seller" party={agreement.seller} dealershipName={agreement.dealership.name} />}
              <PartyRow role="Witness" party={agreement.witness} dealershipName={agreement.dealership.name} />
              <PartyRow role="Next of kin" party={agreement.nextOfKin} dealershipName={agreement.dealership.name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CarFront className="size-4 text-accent-foreground" />
                Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div>
                <p className="font-medium">
                  {agreement.car.year} {agreement.car.brand} {agreement.car.name}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Reg no</dt>
                  <dd className="font-mono">{agreement.car.regNo ?? "—"}</dd>
                  <dt className="text-muted-foreground">Chassis</dt>
                  <dd className="truncate font-mono">{agreement.car.chassisNo ?? "—"}</dd>
                  <dt className="text-muted-foreground">Engine</dt>
                  <dd className="truncate font-mono">{agreement.car.engineNo ?? "—"}</dd>
                  <dt className="text-muted-foreground">Body · colour</dt>
                  <dd>
                    {agreement.car.bodyType} · {agreement.car.color}
                  </dd>
                  <dt className="text-muted-foreground">Engine size</dt>
                  <dd>{agreement.car.cc.toLocaleString("en-KE")} cc</dd>
                </dl>
              </div>
              {agreement.tradeIns.length > 0 && (
                <div className="grid gap-2 border-t pt-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Trade-ins</p>
                  {agreement.tradeIns.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3">
                      <span>
                        {t.car.year} {t.car.brand} {t.car.name}
                        <span className="block font-mono text-xs text-muted-foreground">{t.car.regNo ?? t.car.chassisNo}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatKES(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="size-4 text-accent-foreground" />
                Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {agreement.bankAccount && (
                <div>
                  <p className="text-xs text-muted-foreground">Pay into</p>
                  <p className="font-medium">{agreement.bankAccount.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {agreement.bankAccount.bankName} · {agreement.bankAccount.accountNumber}
                  </p>
                </div>
              )}
              {agreement.paybill && (
                <p>
                  <span className="text-muted-foreground">Paybill </span>
                  <span className="font-mono">{agreement.paybill}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["Physical logbook", agreement.physicalLogbook],
                    ["Transfer logbook", agreement.transferLogbook],
                    ["Upon payment", agreement.uponPayment],
                    ...(isHp
                      ? ([
                          [agreement.hasTracker ? `Tracker ${agreement.trackerFee ? formatKES(agreement.trackerFee) : ""}` : "No tracker", agreement.hasTracker],
                          ["Additional notes", agreement.includeAdditionalNotes],
                        ] as const)
                      : []),
                  ] as const
                ).map(([label, on]) => (
                  <Badge key={label} variant="outline" className={cn(!on && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                    {on ? <Check /> : <X />}
                    {label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {paymentFor && (
        <RecordPaymentDialog
          key={paymentFor.session}
          agreement={agreement}
          installmentId={paymentFor.installmentId}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
        />
      )}

      <AlertDialog open={reverseConfirm.open} onOpenChange={reverseConfirm.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {reverseConfirm.item &&
                `${formatKES(reverseConfirm.item.amount)} from ${format(parseISO(reverseConfirm.item.paidOn), "d MMM yyyy")} will be removed and every change it made to the schedule undone. The receipt file is deleted too.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep payment</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const payment = reverseConfirm.item
                if (!payment) return
                reverse.mutate(payment.id, {
                  onSuccess: () => toast.success("Payment reversed", { description: formatKES(payment.amount) }),
                  onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't reverse payment"),
                })
              }}
            >
              Reverse payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${number}?`}
        description="This removes the agreement, its schedule and documents. Agreements with recorded payments can't be deleted — reverse the payments first."
        onConfirm={() =>
          deleteAgreement.mutate(agreement.id, {
            onSuccess: () => {
              toast.success("Agreement deleted", { description: number })
              router.push("/agreements" as Route)
            },
            onError: (error) =>
              toast.error(
                error instanceof ApiError && error.status === 409
                  ? "This agreement has payments recorded, so it can't be deleted."
                  : "Couldn't delete agreement",
              ),
          })
        }
      />
    </div>
  )
}
