"use client"

import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type { RowData } from "@tanstack/react-table"

import type { AppTable } from "./features"

export function DataTable<TData extends RowData>({
  table,
  isLoading,
  isFetching,
  empty,
  onRowClick,
}: {
  table: AppTable<TData>
  isLoading: boolean
  isFetching: boolean
  empty: ReactNode
  onRowClick?: (row: TData) => void
}) {
  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length
  const skeletonRows = Math.min(table.state.pagination.pageSize, 10)

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-xs">
      {isFetching && !isLoading && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden" role="progressbar" aria-label="Loading">
          <div className="h-full w-1/3 animate-progress rounded-full bg-primary" />
        </div>
      )}
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn("h-10 text-xs font-medium tracking-wide text-muted-foreground", header.column.columnDef.meta?.className)}
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className={cn("transition-opacity", isFetching && !isLoading && "opacity-70")}>
          {isLoading ? (
            Array.from({ length: skeletonRows }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                {Array.from({ length: columnCount }, (_, cell) => (
                  <TableCell key={cell} className="h-13">
                    <Skeleton className={cn("h-4", cell === 0 ? "w-40" : "w-20")} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn("group/row", onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cn("h-13", cell.column.columnDef.meta?.className)}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
