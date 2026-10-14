"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch, toSearchParams, type Paginated } from "@/lib/api-client"
import type { Jsonify } from "@/lib/types"

import type {
  CreateDealershipValues,
  DealershipDetail,
  DealershipFormValues,
  IssuedCredentials,
  ManagerFormValues,
} from "./dealership-server"
import type { DealershipWithMetrics, PlatformOverview } from "./server"

export type AdminDealership = Jsonify<DealershipWithMetrics>
export type AdminOverview = Jsonify<PlatformOverview>
export type DealershipDetailData = Jsonify<DealershipDetail>
export type AdminManager = DealershipDetailData["managers"][number]
export type { IssuedCredentials }
export type AdminOptions = {
  dealerships: { id: string; code: string; name: string; city: string; status: "active" | "suspended" }[]
  brands: { value: string; count: number }[]
  bodies: { value: string; count: number }[]
}

export function useAdminList<T>(resource: string, params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["admin", resource, params],
    queryFn: ({ signal }) => apiFetch<Paginated<T>>(`/api/admin/${resource}?${toSearchParams(params)}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminOptions() {
  return useQuery({
    queryKey: ["admin", "options"],
    queryFn: ({ signal }) => apiFetch<AdminOptions>("/api/admin/options", { signal }),
    staleTime: 60_000,
  })
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: ({ signal }) => apiFetch<AdminOverview>("/api/admin/overview", { signal }),
  })
}

function useAdminMutation<V, R>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] })
      void queryClient.invalidateQueries({ queryKey: ["billing"] })
    },
  })
}

const send = <T,>(url: string, method: string, body?: unknown) =>
  apiFetch<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })

export const useCreateDealership = () =>
  useAdminMutation((values: CreateDealershipValues) =>
    send<{ dealership: AdminDealership; credentials: IssuedCredentials }>("/api/admin/dealerships", "POST", values),
  )

export const useUpdateDealership = () =>
  useAdminMutation(({ id, values }: { id: string; values: DealershipFormValues }) =>
    send<AdminDealership>(`/api/admin/dealerships/${id}`, "PATCH", values),
  )

export const useDeleteDealership = () => useAdminMutation((id: string) => send<void>(`/api/admin/dealerships/${id}`, "DELETE"))

export function useDealershipDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "dealership", id],
    queryFn: ({ signal }) => apiFetch<DealershipDetailData>(`/api/admin/dealerships/${id}`, { signal }),
  })
}

export const useAddManager = (dealershipId: string) =>
  useAdminMutation((values: ManagerFormValues) =>
    send<{ credentials: IssuedCredentials }>(`/api/admin/dealerships/${dealershipId}/managers`, "POST", values),
  )

export const useManagerAction = (dealershipId: string) =>
  useAdminMutation(({ userId, action }: { userId: string; action: "reset_password" | "disable" | "enable" }) =>
    send<{ credentials?: IssuedCredentials }>(`/api/admin/dealerships/${dealershipId}/managers/${userId}`, "PATCH", { action }),
  )
