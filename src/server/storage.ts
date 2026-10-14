import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { HttpError } from "./http"

// Local disk for now; swap these three functions for S3/R2 calls in production without touching callers.
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./.data/uploads")

export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/rtf": "rtf",
  "image/jpeg": "jpg",
  "image/png": "png",
}

export const RECEIPT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export function validateUpload(file: unknown, allowed: Record<string, string>, maxMb: number): File {
  if (!(file instanceof File) || file.size === 0) throw new HttpError(422, "Please attach a file")
  if (!allowed[file.type]) {
    throw new HttpError(422, `Unsupported file type. Allowed: ${[...new Set(Object.values(allowed))].join(", ").toUpperCase()}`)
  }
  if (file.size > maxMb * 1024 * 1024) throw new HttpError(422, `File must be smaller than ${maxMb} MB`)
  return file
}

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key)
  if (!full.startsWith(ROOT + path.sep)) throw new HttpError(400, "Invalid file key")
  return full
}

export async function saveFile(folder: string, file: File, allowed: Record<string, string>) {
  const key = `${folder}/${randomUUID()}.${allowed[file.type]}`
  const full = resolveKey(key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, Buffer.from(await file.arrayBuffer()))
  return key
}

export async function readStoredFile(key: string) {
  return readFile(resolveKey(key))
}

export async function deleteStoredFile(key: string) {
  await rm(resolveKey(key), { force: true })
}

export function fileResponse(body: Buffer, fileName: string, mimeType: string, disposition: "inline" | "attachment") {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0",
    },
  })
}
