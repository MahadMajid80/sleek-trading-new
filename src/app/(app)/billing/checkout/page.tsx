import type { Metadata } from "next"
import { Suspense } from "react"

import { SandboxCheckoutView } from "@/features/billing/sandbox-checkout-view"

export const metadata: Metadata = { title: "Checkout" }

export default function CheckoutPage() {
  return (
    <Suspense>
      <SandboxCheckoutView />
    </Suspense>
  )
}
