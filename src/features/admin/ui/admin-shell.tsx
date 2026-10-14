"use client"

import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  CarFront,
  FilePen,
  Layers,
  LayoutDashboard,
  Receipt,
  ReceiptText,
  Repeat,
  TrendingUp,
  Users,
  Wallet,
  Webhook,
  type LucideIcon,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { BrandMark } from "@/components/shell/brand-logo"
import { ThemeMenuButton, ThemeToggle } from "@/components/shell/theme-toggle"
import { UserMenu, type MenuUser } from "@/components/shell/user-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type AdminNavItem = { title: string; href: Route; icon: LucideIcon }

export const adminNav: { label: string; items: AdminNavItem[] }[] = [
  {
    label: "Platform",
    items: [
      { title: "Overview", href: "/admin" as Route, icon: LayoutDashboard },
      { title: "Dealerships", href: "/admin/dealerships" as Route, icon: Building2 },
    ],
  },
  {
    label: "Billing",
    items: [
      { title: "Revenue", href: "/admin/billing" as Route, icon: TrendingUp },
      { title: "Subscriptions", href: "/admin/billing/subscriptions" as Route, icon: Repeat },
      { title: "Billing invoices", href: "/admin/billing/invoices" as Route, icon: ReceiptText },
      { title: "Transactions", href: "/admin/billing/transactions" as Route, icon: ArrowLeftRight },
      { title: "Plans", href: "/admin/billing/plans" as Route, icon: Layers },
      { title: "Event log", href: "/admin/billing/events" as Route, icon: Webhook },
    ],
  },
  {
    label: "Dealership data",
    items: [
      { title: "Customers", href: "/admin/customers" as Route, icon: Users },
      { title: "Vehicles", href: "/admin/vehicles" as Route, icon: CarFront },
      { title: "Agreements", href: "/admin/agreements" as Route, icon: FilePen },
      { title: "Installments", href: "/admin/installments" as Route, icon: CalendarClock },
      { title: "Customer payments", href: "/admin/payments" as Route, icon: Wallet },
      { title: "Sales invoices", href: "/admin/invoices" as Route, icon: Receipt },
    ],
  },
]

const allItems = adminNav.flatMap((group) => group.items)
// Section roots ("/admin", "/admin/billing") only match exactly, so a child page doesn't light up its parent too.
const EXACT = new Set(["/admin", "/admin/billing"])
const isActive = (pathname: string, href: string) => (EXACT.has(href) ? pathname === href : pathname.startsWith(href))

export function AdminSidebar({ user }: { user: MenuUser }) {
  const pathname = usePathname()
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="AutoVault"
              className="h-auto gap-3 py-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
            >
              <Link href={"/admin" as Route}>
                {/* Same artwork as the favicon (src/app/icon.png), at full resolution. */}
                <BrandMark className="size-12 shrink-0 group-data-[collapsible=icon]:size-8" />
                <span className="flex-1 truncate text-left font-heading text-2xl font-bold tracking-tight">AutoVault</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {adminNav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(pathname, item.href)}
                      tooltip={item.title}
                      className="data-[active=true]:bg-(--signal)/12 data-[active=true]:font-semibold data-[active=true]:shadow-[inset_2px_0_0_var(--signal)] data-[active=true]:[&>svg]:text-(--gold)"
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeMenuButton />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function AdminHeader() {
  const pathname = usePathname()
  const current = allItems.find((item) => isActive(pathname, item.href))
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/60 px-3 backdrop-blur-xl md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4" />
      <span className="hidden text-sm text-muted-foreground md:inline">Super admin</span>
      <span className="hidden text-muted-foreground md:inline">/</span>
      <span className="text-sm font-medium">{current?.title ?? "Overview"}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium sm:inline-flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--signal) opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-(--signal) shadow-[0_0_8px_var(--signal)]" />
          </span>
          Live · all dealerships
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}

/** Faint grid fading out from the top with a soft gold glow behind the page header. */
export function CommandBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-size-[44px_44px] mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,black,transparent)]" />
      <div className="absolute -top-56 left-1/2 h-[26rem] w-[48rem] -translate-x-1/2 rounded-full bg-(--signal) opacity-[0.12] blur-[130px] dark:opacity-[0.16]" />
    </div>
  )
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1.5">
        <span className="signal-text w-fit font-mono text-[12px] font-bold tracking-[0.22em] uppercase">Super admin</span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
