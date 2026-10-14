import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminRevenueView } from "@/features/admin/billing/revenue-view"

export const metadata: Metadata = { title: "Revenue" }

export default function AdminBillingRevenuePage() {
  return (
    <Suspense>
      <AdminRevenueView />
    </Suspense>
  )
}
