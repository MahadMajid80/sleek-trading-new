import { NextResponse } from "next/server"

import { deleteAgreementDocument, readAgreementDocument } from "@/features/agreements/documents"
import { assertId, handleRouteError } from "@/server/http"
import { fileResponse } from "@/server/storage"
import { currentDealershipId } from "@/server/tenant"

type Context = RouteContext<"/api/agreements/[id]/documents/[documentId]">

export async function GET(request: Request, { params }: Context) {
  try {
    const { id, documentId } = await params
    const { row, body } = await readAgreementDocument(await currentDealershipId(), assertId(id), assertId(documentId))
    const inline = new URL(request.url).searchParams.get("inline") === "1"
    return fileResponse(body, row.fileName, row.mimeType ?? "application/octet-stream", inline ? "inline" : "attachment")
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id, documentId } = await params
    await deleteAgreementDocument(await currentDealershipId(), assertId(id), assertId(documentId))
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
