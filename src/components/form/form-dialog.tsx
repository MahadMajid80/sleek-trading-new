"use client"

import type { LucideIcon } from "lucide-react"
import type { FormEventHandler, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModKey } from "@/components/mod-key"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"

export function FormDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  submitLabel,
  isSubmitting,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: LucideIcon
  title: string
  description: string
  submitLabel: string
  isSubmitting: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <form
          onSubmit={onSubmit}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.requestSubmit()
          }}
          noValidate
        >
          <DialogHeader className="flex-row items-center gap-3 border-b p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-accent-foreground ring-1 ring-primary/15">
              <Icon className="size-5" />
            </div>
            <div className="grid gap-0.5 text-left">
              <DialogTitle className="text-base">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </DialogHeader>
          <div className="max-h-[65svh] overflow-y-auto p-5">{children}</div>
          <DialogFooter className="m-0 items-center rounded-b-xl px-5 py-4">
            <p className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <KbdGroup>
                <Kbd><ModKey /></Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              to save
            </p>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-28">
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
