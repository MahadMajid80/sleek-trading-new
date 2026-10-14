import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminInvoicesView } from "@/features/admin/views/invoices-view"

export const metadata: Metadata = { title: "Sales invoices" }

export default function AdminInvoicesPage() {
  return (
    <Suspense>
      <AdminInvoicesView />
    </Suspense>
  )
}
