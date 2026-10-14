import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminPlansView } from "@/features/admin/billing/plans-view"

export const metadata: Metadata = { title: "Plans" }

export default function AdminBillingPlansPage() {
  return (
    <Suspense>
      <AdminPlansView />
    </Suspense>
  )
}
