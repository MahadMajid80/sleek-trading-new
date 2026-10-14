import { NextResponse } from "next/server"

import { bankAccountSchema } from "@/features/bank-accounts/schema"
import { bankAccountConstraintMessages, createBankAccount, listBankAccounts } from "@/features/bank-accounts/server"
import { handleRouteError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listBankAccounts(await currentDealershipId(), request.url))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, bankAccountSchema)
    return NextResponse.json(await createBankAccount(await currentDealershipId(), input), { status: 201 })
  } catch (error) {
    return handleRouteError(error, bankAccountConstraintMessages)
  }
}
