import type { Metadata } from "next"
import { Suspense } from "react"

import { InstallmentsView } from "@/features/installments/installments-view"

export const metadata: Metadata = { title: "Installments" }

export default function InstallmentsPage() {
  return (
    <Suspense>
      <InstallmentsView />
    </Suspense>
  )
}
