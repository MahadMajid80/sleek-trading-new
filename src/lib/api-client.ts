export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: FieldErrors = {},
  ) {
    super(message)
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  // File uploads (FormData) must not get a JSON content type: the browser adds the multipart boundary itself.
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData
  const response = await fetch(url, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  })

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(body.error ?? "Something went wrong", response.status, body.fieldErrors)
  }
  return body as T
}

export type Paginated<T> = { rows: T[]; rowCount: number }

export type ListParams = {
  page: number
  perPage: number
  sort: string
  q: string
}

export function toSearchParams(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  return search.toString()
}
