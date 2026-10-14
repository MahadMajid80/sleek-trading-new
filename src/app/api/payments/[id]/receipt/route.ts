import { readReceipt } from "@/features/payments/server"
import { assertId, handleRouteError } from "@/server/http"
import { fileResponse } from "@/server/storage"
import { currentDealershipId } from "@/server/tenant"

export async function GET(request: Request, { params }: RouteContext<"/api/payments/[id]/receipt">) {
  try {
    const { row, body } = await readReceipt(await currentDealershipId(), assertId((await params).id))
    const inline = new URL(request.url).searchParams.get("inline") === "1"
    return fileResponse(body, row.receiptName, row.receiptMimeType, inline ? "inline" : "attachment")
  } catch (error) {
    return handleRouteError(error)
  }
}
