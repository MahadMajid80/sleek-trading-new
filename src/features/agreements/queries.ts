"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError, apiFetch, toSearchParams, type ListParams, type Paginated } from "@/lib/api-client"
import type { Jsonify } from "@/lib/types"
import type { PaymentPlan } from "@/features/installments/ledger"

import type { AgreementFormValues, AgreementType } from "./schema"
import type { AgreementDetail, AgreementListRow } from "./server"

export type AgreementRow = Jsonify<AgreementListRow>
export type AgreementDetailData = Jsonify<AgreementDetail>

export const agreementKeys = {
  all: ["agreements"] as const,
  list: (params: ListParams & Record<string, string | number | undefined>) => ["agreements", "list", params] as const,
  detail: (id: string) => ["agreements", "detail", id] as const,
}

// Anything that changes money on an agreement also changes these lists and the dashboard figures.
const MONEY_KEYS = [["agreements"], ["installments"], ["payments"], ["search"]] as const

function useInvalidateMoney() {
  const queryClient = useQueryClient()
  return () => MONEY_KEYS.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey: [...queryKey] }))
}

export function useAgreements(params: ListParams & Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: agreementKeys.list(params),
    queryFn: ({ signal }) => apiFetch<Paginated<AgreementRow>>(`/api/agreements?${toSearchParams(params)}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAgreement(id: string, initialData?: AgreementDetailData) {
  return useQuery({
    queryKey: agreementKeys.detail(id),
    queryFn: ({ signal }) => apiFetch<AgreementDetailData>(`/api/agreements/${id}`, { signal }),
    initialData,
  })
}

export function useSaveAgreement() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: AgreementFormValues }) =>
      apiFetch<{ id: string; number: number }>(id ? `/api/agreements/${id}` : "/api/agreements", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteAgreement() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/agreements/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}

async function postForm<T>(url: string, form: FormData): Promise<T> {
  // No JSON content-type: the browser sets the multipart boundary itself.
  const response = await fetch(url, { method: "POST", body: form })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(body.error ?? "Upload failed", response.status, body.fieldErrors)
  return body as T
}

export function useUploadDocument(agreementId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.set("file", file)
      return postForm(`/api/agreements/${agreementId}/documents`, form)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agreementKeys.detail(agreementId) }),
  })
}

export function useDeleteDocument(agreementId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<void>(`/api/agreements/${agreementId}/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agreementKeys.detail(agreementId) }),
  })
}

export type RecordPaymentInput = {
  installmentId: string
  amount: string
  paidOn: string
  notes: string
  carryShortfall: boolean
  receipt: File
}

export function useRecordPayment(agreementId: string) {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => {
      const form = new FormData()
      form.set("installmentId", input.installmentId)
      form.set("amount", input.amount)
      form.set("paidOn", input.paidOn)
      form.set("notes", input.notes)
      form.set("carryShortfall", String(input.carryShortfall))
      form.set("receipt", input.receipt)
      return postForm<PaymentPlan & { id: string }>(`/api/agreements/${agreementId}/payments`, form)
    },
    onSuccess: invalidate,
  })
}

export function useReversePayment(agreementId: string) {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiFetch<void>(`/api/agreements/${agreementId}/payments/${paymentId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}

export const agreementTypeParam = (type: string): AgreementType | "" =>
  type === "cash_sale" || type === "hire_purchase" || type === "buying" ? type : ""
