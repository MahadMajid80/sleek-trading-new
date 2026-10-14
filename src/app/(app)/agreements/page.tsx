import type { Metadata } from "next"
import { Suspense } from "react"

import { AgreementsView } from "@/features/agreements/agreements-view"

export const metadata: Metadata = { title: "Agreements" }

export default function AgreementsPage() {
  return (
    <Suspense>
      <AgreementsView />
    </Suspense>
  )
}
