import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminBillingEventsView } from "@/features/admin/billing/events-view"

export const metadata: Metadata = { title: "Event log" }

export default function AdminBillingEventlogPage() {
  return (
    <Suspense>
      <AdminBillingEventsView />
    </Suspense>
  )
}
