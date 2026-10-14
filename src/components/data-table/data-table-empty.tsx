"use client"

import { CircleAlert, Plus, SearchX, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function DataTableEmpty({
  error,
  onRetry,
  search,
  onClearSearch,
  searchHint,
  icon: Icon,
  title,
  description,
  addLabel,
  onAdd,
}: {
  error: Error | null
  onRetry: () => void
  search: string
  onClearSearch: () => void
  searchHint: string
  icon: LucideIcon
  title: string
  description: string
  addLabel: string
  onAdd: () => void
}) {
  if (error) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>{error.message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (search) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>No results for “{search}”</EmptyTitle>
          <EmptyDescription>{searchHint}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearSearch}>
            Clear search
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onAdd}>
          <Plus data-icon="inline-start" />
          {addLabel}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
