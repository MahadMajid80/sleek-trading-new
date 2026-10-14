import type { Metadata } from "next"
import { Suspense } from "react"

import { InvoicesView } from "@/features/invoices/invoices-view"

export const metadata: Metadata = { title: "Final invoices" }

export default function Page() {
  return (
    <Suspense>
      <InvoicesView kind="final" />
    </Suspense>
  )
}
