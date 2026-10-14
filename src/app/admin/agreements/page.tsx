import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminAgreementsView } from "@/features/admin/views/agreements-view"

export const metadata: Metadata = { title: "Agreements" }

export default function AdminAgreementsPage() {
  return (
    <Suspense>
      <AdminAgreementsView />
    </Suspense>
  )
}
