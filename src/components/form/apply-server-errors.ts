import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import { toast } from "sonner"

import { ApiError } from "@/lib/api-client"

// Maps a failed save onto the form: field-level messages inline, anything else as a toast.
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (error instanceof ApiError) {
    const entries = Object.entries(error.fieldErrors ?? {})
    entries.forEach(([field, message], index) =>
      setError(field as Path<T>, { type: "server", message }, { shouldFocus: index === 0 }),
    )
    if (entries.length === 0 || error.status >= 500) toast.error(error.message)
    return
  }
  toast.error("Couldn't reach the server. Check your connection and try again.")
}
