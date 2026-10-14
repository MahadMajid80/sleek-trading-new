import type { Metadata } from "next"
import { Suspense } from "react"

import { CarsView } from "@/features/cars/cars-view"

export const metadata: Metadata = { title: "Vehicles" }

export default function CarsPage() {
  return (
    <Suspense>
      <CarsView />
    </Suspense>
  )
}
