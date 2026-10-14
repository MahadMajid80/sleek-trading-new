"use client"

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

import type { RowData } from "@tanstack/react-table"

import type { AppColumn } from "./features"

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: {
  column: AppColumn<TData, TValue>
  title: string
  className?: string
}) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>
  }

  const sorted = column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      aria-label={`Sort by ${title}`}
      className={cn(
        "-ml-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        sorted && "text-foreground",
        className,
      )}
    >
      {title}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} />
    </button>
  )
}
