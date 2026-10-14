import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminSubscriptionsView } from "@/features/admin/billing/subscriptions-view"

export const metadata: Metadata = { title: "Subscriptions" }

export default function AdminBillingSubscriptionsPage() {
  return (
    <Suspense>
      <AdminSubscriptionsView />
    </Suspense>
  )
}
