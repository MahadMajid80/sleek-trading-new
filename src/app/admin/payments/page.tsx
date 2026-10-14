import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminPaymentsView } from "@/features/admin/views/payments-view"

export const metadata: Metadata = { title: "Customer payments" }

export default function AdminPaymentsPage() {
  return (
    <Suspense>
      <AdminPaymentsView />
    </Suspense>
  )
}
