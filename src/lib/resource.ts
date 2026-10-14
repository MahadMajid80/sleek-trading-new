"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch, toSearchParams, type ListParams, type Paginated } from "./api-client"

/** Extra per-table filters (see useTableFilters), sent alongside paging/sorting. */
type Filters = Record<string, string | number | undefined>

export function createResource<TRow extends { id: string }, TFormValues>(name: string, basePath: string) {
  const keys = {
    all: [name] as const,
    list: (params: ListParams & Filters) => [name, "list", params] as const,
  }

  function useList(params: ListParams & Filters) {
    return useQuery({
      queryKey: keys.list(params),
      queryFn: ({ signal }) => apiFetch<Paginated<TRow>>(`${basePath}?${toSearchParams(params)}`, { signal }),
      placeholderData: keepPreviousData,
    })
  }

  function useSave() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({ id, values }: { id?: string; values: TFormValues }) =>
        apiFetch<TRow>(id ? `${basePath}/${id}` : basePath, {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(values),
        }),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: keys.all })
        void queryClient.invalidateQueries({ queryKey: ["search"] })
      },
    })
  }

  // Optimistic: the row disappears immediately and comes back if the server refuses.
  function useDelete() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (id: string) => apiFetch<void>(`${basePath}/${id}`, { method: "DELETE" }),
      onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: keys.all })
        const snapshot = queryClient.getQueriesData<Paginated<TRow>>({ queryKey: keys.all })
        queryClient.setQueriesData<Paginated<TRow>>({ queryKey: keys.all }, (old) =>
          old ? { rows: old.rows.filter((row) => row.id !== id), rowCount: old.rowCount - 1 } : old,
        )
        return { snapshot }
      },
      onError: (_error, _id, context) => {
        for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: keys.all })
        void queryClient.invalidateQueries({ queryKey: ["search"] })
      },
    })
  }

  return { keys, useList, useSave, useDelete }
}
