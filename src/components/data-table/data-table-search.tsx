"use client"

import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

export function DataTableSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState(value)
  const [sent, setSent] = useState(value)

  // The URL changed from elsewhere (Back button, ⌘K navigation) — adopt it.
  if (value !== sent) {
    setSent(value)
    setDraft(value)
  }

  useEffect(() => {
    const next = draft.trim()
    if (next === sent) return
    const timeout = setTimeout(() => {
      setSent(next)
      onChange(next)
    }, 300)
    return () => clearTimeout(timeout)
  }, [draft, sent, onChange])

  return (
    <InputGroup className="h-9 w-full sm:max-w-xs">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setDraft("")
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {draft && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" onClick={() => setDraft("")} aria-label="Clear search">
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
