"use client"

import { KeyRound } from "lucide-react"
import { useState } from "react"

import { ChangePasswordDialog } from "@/components/shell/user-menu"

/** Shown to anyone still on a temporary password an admin issued, until they pick their own. */
export function PasswordReminder() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex items-center gap-3 border-b border-warning/40 bg-warning/12 px-4 py-2 text-sm md:px-6">
        <KeyRound className="size-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1 truncate">You&apos;re using a temporary password. Choose your own to secure your account.</span>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 font-semibold underline-offset-4 hover:underline">
          Change password →
        </button>
      </div>
      <ChangePasswordDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
