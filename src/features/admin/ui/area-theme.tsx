"use client"

import { useEffect } from "react"

// The server puts `admin` on <html> for direct loads; this keeps it right on client-side navigation between areas.
export function AdminAreaTheme() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("admin")
    return () => root.classList.remove("admin")
  }, [])
  return null
}
