"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-client"
import type { Jsonify } from "@/lib/types"

import type {
  BillingInvoiceListRow,
  BillingSummary,
  BillingTransactionListRow,
  PlanFormValues,
  RevenueOverview,
  SubscriptionListRow,
} from "./server"

export type BillingSummaryData = Jsonify<BillingSummary>
export type BillingPlanRow = BillingSummaryData["plans"][number]
export type RevenueOverviewData = Jsonify<RevenueOverview>
export type SubscriptionRow = Jsonify<SubscriptionListRow>
export type BillingInvoiceRow = Jsonify<BillingInvoiceListRow>
export type BillingTransactionRow = Jsonify<BillingTransactionListRow>
export type BillingEventRow = {
  id: string
  provider: "stripe" | "sandbox"
  type: string
  summary: string | null
  error: string | null
  receivedAt: string
  processedAt: string | null
  dealershipCode: string | null
}

export type SubscriptionAction = { action: "change_plan"; planId: string } | { action: "cancel"; atPeriodEnd: boolean } | { action: "resume" }

const post = <T,>(url: string, body?: unknown, method = "POST") =>
  apiFetch<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })

/** Billing changes ripple into both the staff billing page and every admin billing screen. */
function useBillingMutation<V, R>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] })
      void queryClient.invalidateQueries({ queryKey: ["admin"] })
    },
  })
}

// ─── Staff (current dealership) ──────────────────────────────────────────────────────────────────────────────────────

export function useBilling() {
  return useQuery({
    queryKey: ["billing", "summary"],
    queryFn: ({ signal }) => apiFetch<BillingSummaryData>("/api/billing", { signal }),
  })
}

export const useStartCheckout = () => useBillingMutation((planId: string) => post<{ url: string }>("/api/billing/checkout", { planId }))
export const useOpenPortal = () => useBillingMutation(() => post<{ url: string }>("/api/billing/portal"))
export const useSubscriptionAction = () =>
  useBillingMutation(({ id, ...action }: SubscriptionAction & { id: string }) => post(`/api/billing/subscriptions/${id}`, action, "PATCH"))
export const usePayInvoice = () =>
  useBillingMutation((id: string) => post<{ paid: boolean; message?: string }>(`/api/billing/invoices/${id}/pay`))
export const useSandboxCheckout = () =>
  useBillingMutation((input: { planId: string; outcome: "approves" | "declines" }) => post("/api/billing/sandbox/checkout", input))
export const useSandboxCard = () => useBillingMutation((declines: boolean) => post("/api/billing/sandbox/card", { declines }))

// ─── Super admin ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function useRevenueOverview() {
  return useQuery({
    queryKey: ["admin", "billing", "overview"],
    queryFn: ({ signal }) => apiFetch<RevenueOverviewData>("/api/admin/billing/overview", { signal }),
  })
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "billing", "plans"],
    queryFn: ({ signal }) => apiFetch<BillingPlanRow[]>("/api/admin/billing/plans", { signal }),
  })
}

export const useAdminSubscriptionAction = () =>
  useBillingMutation(({ id, ...action }: SubscriptionAction & { id: string }) =>
    post(`/api/admin/billing/subscriptions/${id}`, action, "PATCH"),
  )
export const useAdminInvoiceAction = () =>
  useBillingMutation(({ id, action }: { id: string; action: "pay" | "void" }) =>
    post<{ paid?: boolean; message?: string; ok?: boolean }>(`/api/admin/billing/invoices/${id}`, { action }),
  )
export const useRefund = () => useBillingMutation((id: string) => post(`/api/admin/billing/transactions/${id}/refund`))
export const useSavePlan = () =>
  useBillingMutation(({ id, values }: { id?: string; values: PlanFormValues }) =>
    post(id ? `/api/admin/billing/plans/${id}` : "/api/admin/billing/plans", values, id ? "PATCH" : "POST"),
  )
export const useDeletePlan = () => useBillingMutation((id: string) => post<void>(`/api/admin/billing/plans/${id}`, undefined, "DELETE"))
export const useRunRenewals = () =>
  useBillingMutation(() =>
    post<{ renewed: number; paid: number; failed: number; canceled: number; retried: number }>("/api/admin/billing/sandbox/renewals", { force: true }),
  )
