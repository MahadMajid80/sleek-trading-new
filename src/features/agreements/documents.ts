import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { agreementDocuments } from "@/db/schema"
import { HttpError } from "@/server/http"
import { DOCUMENT_TYPES, deleteStoredFile, readStoredFile, saveFile, validateUpload } from "@/server/storage"

import { assertAgreementInScope } from "./guard"

export async function uploadAgreementDocument(scope: string, agreementId: string, file: unknown) {
  const upload = validateUpload(file, DOCUMENT_TYPES, 10)
  await assertAgreementInScope(scope, agreementId)

  const storageKey = await saveFile(`agreements/${agreementId}`, upload, DOCUMENT_TYPES)
  try {
    const [row] = await db
      .insert(agreementDocuments)
      .values({ agreementId, fileName: upload.name, storageKey, mimeType: upload.type, sizeBytes: upload.size })
      .returning()
    return row!
  } catch (error) {
    await deleteStoredFile(storageKey)
    throw error
  }
}

async function findDocument(agreementId: string, documentId: string) {
  const [row] = await db
    .select()
    .from(agreementDocuments)
    .where(and(eq(agreementDocuments.id, documentId), eq(agreementDocuments.agreementId, agreementId)))
  if (!row) throw new HttpError(404, "Document not found")
  return row
}

export async function readAgreementDocument(scope: string | null, agreementId: string, documentId: string) {
  await assertAgreementInScope(scope, agreementId)
  const row = await findDocument(agreementId, documentId)
  return { row, body: await readStoredFile(row.storageKey) }
}

export async function deleteAgreementDocument(scope: string, agreementId: string, documentId: string) {
  await assertAgreementInScope(scope, agreementId)
  const row = await findDocument(agreementId, documentId)
  await db.delete(agreementDocuments).where(eq(agreementDocuments.id, row.id))
  await deleteStoredFile(row.storageKey)
}
