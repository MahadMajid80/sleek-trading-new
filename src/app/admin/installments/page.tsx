import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminInstallmentsView } from "@/features/admin/views/installments-view"

export const metadata: Metadata = { title: "Installments" }

export default function AdminInstallmentsPage() {
  return (
    <Suspense>
      <AdminInstallmentsView />
    </Suspense>
  )
}
