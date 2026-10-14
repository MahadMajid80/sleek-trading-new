import { readReceipt } from "@/features/payments/server"
import { assertId, handleRouteError } from "@/server/http"
import { fileResponse } from "@/server/storage"
import { requireSuperAdmin } from "@/server/auth"

export async function GET(_request: Request, { params }: RouteContext<"/api/admin/payments/[id]/receipt">) {
  try {
    await requireSuperAdmin()
    const { row, body } = await readReceipt(null, assertId((await params).id))
    return fileResponse(body, row.receiptName, row.receiptMimeType, "inline")
  } catch (error) {
    return handleRouteError(error)
  }
}
