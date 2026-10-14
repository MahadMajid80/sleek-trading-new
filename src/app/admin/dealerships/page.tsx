import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminDealershipsView } from "@/features/admin/views/dealerships-view"

export const metadata: Metadata = { title: "Dealerships" }

export default function AdminDealershipsPage() {
  return (
    <Suspense>
      <AdminDealershipsView />
    </Suspense>
  )
}
