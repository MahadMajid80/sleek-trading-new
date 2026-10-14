import type { Metadata } from "next"
import { Suspense } from "react"

import { CustomersView } from "@/features/customers/customers-view"

export const metadata: Metadata = { title: "Customers" }

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  )
}
