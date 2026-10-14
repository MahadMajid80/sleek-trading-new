import type { Metadata } from "next"
import { Suspense } from "react"

import { PaymentsView } from "@/features/payments/payments-view"

export const metadata: Metadata = { title: "Payments" }

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsView />
    </Suspense>
  )
}
