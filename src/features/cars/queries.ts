"use client"

import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-client"
import { createResource } from "@/lib/resource"

import type { CarFormValues, CarRow } from "./schema"

export const carsResource = createResource<CarRow, CarFormValues>("cars", "/api/vehicles")

type Facet = { value: string; count: number }

/** Lives under the "cars" key, so saving or deleting a car refreshes the filter counts too. */
export function useCarFacets() {
  return useQuery({
    queryKey: [...carsResource.keys.all, "facets"],
    queryFn: ({ signal }) => apiFetch<{ brands: Facet[]; bodies: Facet[] }>("/api/vehicles/facets", { signal }),
    staleTime: 60_000,
  })
}
