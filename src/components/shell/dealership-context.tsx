"use client"

import { createContext, useContext, type ReactNode } from "react"

export type DealershipSummary = {
  id: string
  /** Short code that prefixes agreement numbers, e.g. NRB. */
  code: string
  name: string
  city: string
  /** What the dashboard calls itself: the dealership's own title if it set one, else its name. */
  title: string
  /** Same-origin URL of the uploaded logo (already versioned), or null for the default mark. */
  logoUrl: string | null
  logoWide: boolean
}

const DealershipContext = createContext<{ current: DealershipSummary } | null>(null)

export function DealershipProvider({ current, children }: { current: DealershipSummary; children: ReactNode }) {
  return <DealershipContext.Provider value={{ current }}>{children}</DealershipContext.Provider>
}

export function useDealership() {
  const value = useContext(DealershipContext)
  if (!value) throw new Error("useDealership must be used inside DealershipProvider")
  return value
}
