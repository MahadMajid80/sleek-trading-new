"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ModKey } from "@/components/mod-key"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { findNavItem } from "@/config/navigation"
import { useCommandStore } from "@/stores/command-store"

import { useDealership } from "./dealership-context"
import { ThemeToggle } from "./theme-toggle"

export function SiteHeader() {
  const pathname = usePathname()
  const { current: dealership } = useDealership()
  const current = findNavItem(pathname)
  const openCommand = () => useCommandStore.getState().setOpen(true)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/75 px-3 backdrop-blur-xl supports-backdrop-filter:bg-background/60 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden lg:block">
            <BreadcrumbLink asChild>
              <Link href="/">{dealership.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden lg:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{current?.title ?? "Dashboard"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={openCommand}
          className="group flex h-8 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground sm:w-56 lg:w-80"
          aria-label="Search or jump to (Command K)"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">Search or jump to…</span>
          <KbdGroup className="ml-auto hidden sm:inline-flex">
            <Kbd><ModKey /></Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
