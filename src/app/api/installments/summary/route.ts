import { NextResponse } from "next/server"

import { installmentTotals } from "@/features/installments/server"
import { paymentTotals } from "@/features/payments/server"
import { handleRouteError } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET() {
  try {
    const [installments, payments] = await Promise.all([installmentTotals(await currentDealershipId()), paymentTotals(await currentDealershipId())])
    return NextResponse.json({ ...installments, collectedThisMonth: payments.thisMonth, paymentsThisMonth: payments.countThisMonth })
  } catch (error) {
    return handleRouteError(error)
  }
}
