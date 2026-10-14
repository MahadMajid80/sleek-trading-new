import { NextResponse } from "next/server"

import { installmentTotals } from "@/features/installments/server"
import { paymentTotals } from "@/features/payments/server"
import { handleRouteError } from "@/server/http"
import { requireSuperAdmin } from "@/server/auth"

export async function GET() {
  try {
    await requireSuperAdmin()
    const [installments, payments] = await Promise.all([installmentTotals(null), paymentTotals(null)])
    return NextResponse.json({ ...installments, collectedThisMonth: payments.thisMonth, paymentsThisMonth: payments.countThisMonth })
  } catch (error) {
    return handleRouteError(error)
  }
}
