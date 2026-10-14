import {
  CalendarClock,
  CarFront,
  CreditCard,
  FilePen,
  FileText,
  Landmark,
  LayoutDashboard,
  Settings,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { Route } from "next"

type NavItemBase = { title: string; icon: LucideIcon; keywords?: string[] }

export type NavItem =
  | (NavItemBase & { href: Route; soon?: false })
  /** Planned module not yet migrated to the new app; its route doesn't exist yet. */
  | (NavItemBase & { href: string; soon: true })

export type NavGroup = { label: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "overview", "stats"] }],
  },
  {
    label: "Sales",
    items: [
      { title: "Customers", href: "/customers", icon: Users, keywords: ["clients", "buyers", "people", "kra"] },
      { title: "Vehicles", href: "/vehicles", icon: CarFront, keywords: ["cars", "inventory", "stock", "fleet", "available", "trade-in"] },
      { title: "Agreements", href: "/agreements", icon: FilePen, keywords: ["slk", "hire purchase", "hp", "cash sale", "buying", "contract"] },
      { title: "Proforma invoices", href: "/proforma-invoices", icon: FileText, keywords: ["quote", "pro", "invoice", "draft"] },
      { title: "Final invoices", href: "/final-invoices", icon: Receipt, keywords: ["inv", "invoice", "bill"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Installments", href: "/installments", icon: CalendarClock, keywords: ["overdue", "due", "collections", "schedule", "arrears"] },
      { title: "Payments", href: "/payments", icon: Wallet, keywords: ["receipts", "collections", "mpesa", "ledger"] },
      { title: "Bank accounts", href: "/bank-accounts", icon: Landmark, keywords: ["bank", "account", "paybill"] },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Billing", href: "/billing", icon: CreditCard, keywords: ["subscription", "plan", "invoice", "card", "stripe", "upgrade"] },
      { title: "Settings", href: "/settings", icon: Settings, keywords: ["branding", "logo", "title", "colour", "color", "theme", "appearance"] },
    ],
  },
]

export const navItems = navGroups.flatMap((group) => group.items)

export function findNavItem(pathname: string) {
  return navItems.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
}
