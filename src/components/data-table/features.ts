import {
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type Column,
  type ReactTable,
  type RowData,
} from "@tanstack/react-table"

export type AppColumnMeta = {
  /** Human label for menus (column visibility), since `header` is often a component. */
  label?: string
  className?: string
}

// Sorting and pagination run on the server; the table only coordinates state.
export const appTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  columnMeta: {} as AppColumnMeta,
})

export type AppFeatures = typeof appTableFeatures
export type AppTable<TData extends RowData> = ReactTable<AppFeatures, TData>
export type AppColumn<TData extends RowData, TValue = unknown> = Column<AppFeatures, TData, TValue>
