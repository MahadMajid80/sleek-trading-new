import type { Metadata } from "next"
import { Suspense } from "react"

import { DealershipDetailView } from "@/features/admin/dealership-detail-view"

export const metadata: Metadata = { title: "Dealership" }

export default async function AdminDealershipPage({ params }: PageProps<"/admin/dealerships/[id]">) {
  const { id } = await params
  return (
    <Suspense>
      <DealershipDetailView id={id} />
    </Suspense>
  )
}
