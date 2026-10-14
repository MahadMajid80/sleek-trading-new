import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminCustomersView } from "@/features/admin/views/customers-view"

export const metadata: Metadata = { title: "Customers" }

export default function AdminCustomersPage() {
  return (
    <Suspense>
      <AdminCustomersView />
    </Suspense>
  )
}
