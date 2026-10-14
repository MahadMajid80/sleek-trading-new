import { NextResponse } from "next/server"

import { bankAccountSchema } from "@/features/bank-accounts/schema"
import { bankAccountConstraintMessages, deleteBankAccount, updateBankAccount } from "@/features/bank-accounts/server"
import { assertId, handleRouteError, HttpError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

export async function PATCH(request: Request, { params }: RouteContext<"/api/bank-accounts/[id]">) {
  try {
    const id = assertId((await params).id)
    const row = await updateBankAccount(await currentDealershipId(), id, await parseBody(request, bankAccountSchema))
    if (!row) throw new HttpError(404, "Bank account not found")
    return NextResponse.json(row)
  } catch (error) {
    return handleRouteError(error, bankAccountConstraintMessages)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/bank-accounts/[id]">) {
  try {
    const row = await deleteBankAccount(await currentDealershipId(), assertId((await params).id))
    if (!row) throw new HttpError(404, "Bank account not found")
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
