"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch, toSearchParams, type ListParams, type Paginated } from "@/lib/api-client"
import type { Jsonify } from "@/lib/types"

import { invoiceKindMeta, type InvoiceFormValues, type InvoiceKind } from "./schema"
import type { InvoiceDocumentData, InvoiceListRow } from "./server"

export type InvoiceRow = Jsonify<InvoiceListRow>
export type InvoiceDocument = Jsonify<InvoiceDocumentData>

// Proforma and final invoices affect each other (publishing creates a final invoice), so invalidate both.
function useInvalidateInvoices() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["invoices"] })
    void queryClient.invalidateQueries({ queryKey: ["search"] })
  }
}

export function useInvoices(kind: InvoiceKind, params: ListParams & Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["invoices", kind, "list", params],
    queryFn: ({ signal }) =>
      apiFetch<Paginated<InvoiceRow>>(`${invoiceKindMeta[kind].api}?${toSearchParams(params)}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export const fetchInvoiceDocument = (kind: InvoiceKind, id: string) =>
  apiFetch<InvoiceDocument>(`${invoiceKindMeta[kind].api}/${id}`)

export function useSaveInvoice(kind: InvoiceKind) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: InvoiceFormValues }) =>
      apiFetch<{ id: string; number: number }>(id ? `${invoiceKindMeta[kind].api}/${id}` : invoiceKindMeta[kind].api, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: invalidate,
  })
}

export function usePublishProforma() {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; number: number }>(`/api/proforma-invoices/${id}/publish`, { method: "POST" }),
    onSuccess: invalidate,
  })
}

export function useDeleteInvoice(kind: InvoiceKind) {
  const invalidate = useInvalidateInvoices()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`${invoiceKindMeta[kind].api}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}
