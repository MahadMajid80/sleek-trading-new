import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminBillingInvoicesView } from "@/features/admin/billing/invoices-view"

export const metadata: Metadata = { title: "Billing invoices" }

export default function AdminBillingBillinginvoicesPage() {
  return (
    <Suspense>
      <AdminBillingInvoicesView />
    </Suspense>
  )
}
