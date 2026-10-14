"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { FormDialog } from "@/components/form/form-dialog"
import { TextField } from "@/components/form/text-field"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FieldGroup } from "@/components/ui/field"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { apiFetch } from "@/lib/api-client"
import { initials } from "@/lib/format"

export type MenuUser = { name: string; email: string; roleLabel: string }

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Use at least 8 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
type PasswordValues = z.input<typeof passwordSchema>

/** Account chip for the bottom of a sidebar: who is signed in, change password, sign out. */
export function UserMenu({ user }: { user: MenuUser }) {
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await apiFetch("/api/auth/logout", { method: "POST" })
    } finally {
      // A full navigation, so no cached data or per-dealership styling survives into the next session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload
      window.location.assign("/login")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" tooltip={user.name} className="data-[state=open]:bg-sidebar-accent">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initials(user.name)}
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <span className="truncate text-xs opacity-70">{user.roleLabel}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4 opacity-60" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuLabel className="grid gap-0.5 font-normal">
            <span className="text-sm font-semibold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut()} disabled={signingOut}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  )
}

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      })
      toast.success("Password changed", { description: "Other devices were signed out." })
      form.reset()
      onOpenChange(false)
      // The "temporary password" reminder banner is rendered by the server, so ask it to re-render.
      window.location.reload()
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={KeyRound}
      title="Change password"
      description="You'll stay signed in here. Other devices will be signed out."
      submitLabel="Change password"
      isSubmitting={form.formState.isSubmitting}
      onSubmit={submit}
    >
      <FieldGroup className="grid gap-5">
        <TextField control={form.control} name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
        <TextField control={form.control} name="newPassword" label="New password" type="password" autoComplete="new-password" description="At least 8 characters" />
        <TextField control={form.control} name="confirmPassword" label="Repeat new password" type="password" autoComplete="new-password" />
      </FieldGroup>
    </FormDialog>
  )
}
