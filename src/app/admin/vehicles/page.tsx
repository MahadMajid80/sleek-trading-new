import type { Metadata } from "next"
import { Suspense } from "react"

import { AdminCarsView } from "@/features/admin/views/cars-view"

export const metadata: Metadata = { title: "Vehicles" }

export default function AdminCarsPage() {
  return (
    <Suspense>
      <AdminCarsView />
    </Suspense>
  )
}
