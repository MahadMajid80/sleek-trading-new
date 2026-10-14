"use client"

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function RowActions({
  label,
  onEdit,
  onDelete,
  copy,
}: {
  label: string
  onEdit: () => void
  onDelete: () => void
  copy?: { label: string; value: string }
}) {
  return (
    // Keep clicks inside the menu from also triggering the row's own click handler.
    <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground opacity-60 group-hover/row:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for ${label}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            {copy && (
              <DropdownMenuItem
                onSelect={() =>
                  void navigator.clipboard.writeText(copy.value).then(() => toast.success(`${copy.label} copied`))
                }
              >
                <Copy />
                Copy {copy.label.toLowerCase()}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
