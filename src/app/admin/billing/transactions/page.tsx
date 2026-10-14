import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminTransactionsView } from "@/features/admin/billing/transactions-view"

export const metadata: Metadata = { title: "Transactions" }

export default function AdminBillingTransactionsPage() {
  return (
    <Suspense>
      <AdminTransactionsView />
    </Suspense>
  )
}
