import "server-only"

import { NextResponse } from "next/server"

import { assertId, handleRouteError, HttpError, parseBody } from "@/server/http"
import { currentDealershipId } from "@/server/tenant"

import { invoiceSchema, invoiceKindMeta, type InvoiceKind } from "./schema"
import { createInvoice, deleteInvoice, getInvoiceForDocument, listInvoices, updateInvoice } from "./server"

type IdContext = { params: Promise<{ id: string }> }

export function collectionHandlers(kind: InvoiceKind) {
  return {
    GET: async (request: Request) => {
      try {
        return NextResponse.json(await listInvoices(kind, await currentDealershipId(), request.url))
      } catch (error) {
        return handleRouteError(error)
      }
    },
    POST: async (request: Request) => {
      try {
        const row = await createInvoice(kind, await currentDealershipId(), await parseBody(request, invoiceSchema))
        return NextResponse.json(row, { status: 201 })
      } catch (error) {
        return handleRouteError(error)
      }
    },
  }
}

export function itemHandlers(kind: InvoiceKind) {
  const notFound = () => new HttpError(404, `${invoiceKindMeta[kind].singular} not found`)
  return {
    GET: async (_request: Request, { params }: IdContext) => {
      try {
        const row = await getInvoiceForDocument(kind, await currentDealershipId(), assertId((await params).id))
        if (!row) throw notFound()
        return NextResponse.json(row)
      } catch (error) {
        return handleRouteError(error)
      }
    },
    PATCH: async (request: Request, { params }: IdContext) => {
      try {
        const id = assertId((await params).id)
        const row = await updateInvoice(kind, await currentDealershipId(), id, await parseBody(request, invoiceSchema))
        if (!row) throw notFound()
        return NextResponse.json(row)
      } catch (error) {
        return handleRouteError(error)
      }
    },
    DELETE: async (_request: Request, { params }: IdContext) => {
      try {
        const row = await deleteInvoice(kind, await currentDealershipId(), assertId((await params).id))
        if (!row) throw notFound()
        return new NextResponse(null, { status: 204 })
      } catch (error) {
        return handleRouteError(error)
      }
    },
  }
}
