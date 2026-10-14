"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  CarFront,
  Clock,
  FilePen,
  FilePlus2,
  Landmark,
  CornerDownLeft,
  Link2,
  Moon,
  PanelLeft,
  Plus,
  UserPlus,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ModKey } from "@/components/mod-key"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { useSidebar } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { navItems } from "@/config/navigation"
import { agreementTypeMeta, formatAgreementNumber } from "@/features/agreements/schema"
import { apiFetch } from "@/lib/api-client"
import type { SearchResults } from "@/server/search"
import { useCommandStore, type RecentItem } from "@/stores/command-store"
import { useDialogStore } from "@/stores/dialog-store"

import { useToggleTheme } from "./theme-toggle"

type Action = { id: string; title: string; icon: LucideIcon; keywords: string[]; shortcut?: string; run: () => void }

const matches = (query: string, ...fields: (string | undefined)[]) => {
  const haystack = fields.join(" ").toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])
  return debounced
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

export function CommandMenu() {
  const router = useRouter()
  const { open, setOpen, toggle, recent, remember, clearRecent } = useCommandStore()
  const openDialog = useDialogStore((state) => state.open)
  const { toggleSidebar } = useSidebar()
  const toggleTheme = useToggleTheme()
  const [search, setSearch] = useState("")
  const query = useDebounced(search.trim(), 200)

  const records = useQuery({
    queryKey: ["search", query],
    queryFn: ({ signal }) => apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`, { signal }),
    enabled: open && query.length >= 2,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      } else if (event.key === "/" && !isTyping(event.target)) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [toggle, setOpen])

  const close = () => {
    setOpen(false)
    setSearch("")
  }

  const go = (item: RecentItem) => {
    remember(item)
    close()
    router.push(item.href as Route)
  }

  const run = (action: () => void) => {
    close()
    action()
  }

  const goTo = (href: string) => () => router.push(href as Route)

  const actions: Action[] = [
    {
      id: "new-hp",
      title: "New hire purchase agreement",
      icon: FilePen,
      keywords: ["hp", "agreement", "installments", "create", "slk"],
      run: goTo("/agreements/new?type=hire_purchase"),
    },
    {
      id: "new-cash",
      title: "New cash sale agreement",
      icon: FilePen,
      keywords: ["cash", "sale", "agreement", "create", "slk"],
      run: goTo("/agreements/new?type=cash_sale"),
    },
    {
      id: "new-buying",
      title: "New buying agreement",
      icon: FilePen,
      keywords: ["buy", "purchase", "agreement", "create", "slk"],
      run: goTo("/agreements/new?type=buying"),
    },
    {
      id: "overdue",
      title: "Show overdue installments",
      icon: AlertTriangle,
      keywords: ["arrears", "late", "collections", "payment", "record"],
      run: goTo("/installments?filter=overdue"),
    },
    {
      id: "new-proforma",
      title: "New proforma invoice",
      icon: FilePlus2,
      keywords: ["quote", "invoice", "create"],
      run: () => openDialog({ type: "invoice-form", kind: "proforma" }),
    },
    {
      id: "new-final",
      title: "New final invoice",
      icon: FilePlus2,
      keywords: ["invoice", "bill", "create"],
      run: () => openDialog({ type: "invoice-form", kind: "final" }),
    },
    {
      id: "new-bank",
      title: "Add bank account",
      icon: Landmark,
      keywords: ["bank", "account", "paybill", "create"],
      run: () => openDialog({ type: "bank-account-form" }),
    },
    {
      id: "new-customer",
      title: "Add customer",
      icon: UserPlus,
      keywords: ["new", "create", "client", "buyer"],
      run: () => openDialog({ type: "customer-form" }),
    },
    {
      id: "new-car",
      title: "Add vehicle",
      icon: Plus,
      keywords: ["new", "create", "vehicle", "car", "inventory", "trade-in"],
      run: () => openDialog({ type: "car-form" }),
    },
    { id: "theme", title: "Toggle dark mode", icon: Moon, keywords: ["theme", "light", "appearance"], run: toggleTheme },
    { id: "sidebar", title: "Toggle sidebar", icon: PanelLeft, keywords: ["collapse", "expand", "menu"], shortcut: "B", run: toggleSidebar },
    {
      id: "copy-link",
      title: "Copy link to this page",
      icon: Link2,
      keywords: ["share", "url"],
      run: () => void navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied")),
    },
  ]

  const pages = navItems.filter((item) => !item.soon && matches(search, item.title, ...(item.keywords ?? [])))
  const upcoming = navItems.filter((item) => item.soon && search && matches(search, item.title))
  const visibleActions = actions.filter((action) => matches(search, action.title, ...action.keywords))
  const showRecords = query.length >= 2
  const customers = showRecords ? (records.data?.customers ?? []) : []
  const cars = showRecords ? (records.data?.cars ?? []) : []
  const matchedAgreements = showRecords ? (records.data?.agreements ?? []) : []
  const searching = showRecords && records.isFetching
  const nothingFound =
    !searching && !pages.length && !upcoming.length && !visibleActions.length && !customers.length && !cars.length && !matchedAgreements.length

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title="Search"
      description="Search customers and vehicles, jump to a page, or run an action"
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false} loop>
        <div className="relative">
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search agreements, customers, vehicles, pages and actions…" />
          {searching && <Spinner className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground" />}
        </div>
        <CommandList className="max-h-[min(60svh,26rem)]">
          {nothingFound && (
            <CommandEmpty>
              {query.length >= 2 ? `No results for “${search.trim()}”` : "Nothing matches — try another word."}
            </CommandEmpty>
          )}

          {!search && recent.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recent.map((item) => (
                  <CommandItem key={item.key} value={`recent-${item.key}`} onSelect={() => go(item)}>
                    <Clock />
                    <span className="truncate">{item.title}</span>
                    {item.subtitle && <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                  </CommandItem>
                ))}
                <CommandItem value="clear-recent" onSelect={clearRecent} className="text-muted-foreground">
                  <X />
                  Clear recent
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {pages.length > 0 && (
            <CommandGroup heading="Pages">
              {pages.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`page-${item.href}`}
                  onSelect={() => go({ key: `page-${item.href}`, kind: "page", title: item.title, href: item.href })}
                >
                  <item.icon />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {visibleActions.length > 0 && (
            <CommandGroup heading="Actions">
              {visibleActions.map((action) => (
                <CommandItem key={action.id} value={`action-${action.id}`} onSelect={() => run(action.run)}>
                  <action.icon />
                  {action.title}
                  {action.shortcut && (
                    <CommandShortcut>
                      <ModKey />
                      {action.shortcut}
                    </CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchedAgreements.length > 0 && (
            <CommandGroup heading="Agreements">
              {matchedAgreements.map((agreement) => (
                <CommandItem
                  key={agreement.id}
                  value={`agreement-${agreement.id}`}
                  onSelect={() =>
                    go({
                      key: `agreement-${agreement.id}`,
                      kind: "agreement",
                      title: `${formatAgreementNumber(agreement.number, agreement.dealershipCode)} · ${agreement.customerName ?? agreementTypeMeta[agreement.type].short}`,
                      subtitle: agreement.carTitle,
                      href: `/agreements/${agreement.id}`,
                    })
                  }
                >
                  <FilePen />
                  <span className="font-mono text-xs font-semibold">{formatAgreementNumber(agreement.number, agreement.dealershipCode)}</span>
                  <span className="truncate">{agreement.customerName}</span>
                  <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{agreement.carTitle}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {customers.length > 0 && (
            <CommandGroup heading="Customers">
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`customer-${customer.id}`}
                  onSelect={() =>
                    go({
                      key: `customer-${customer.id}`,
                      kind: "customer",
                      title: customer.name,
                      subtitle: customer.telephone,
                      href: `/customers?q=${encodeURIComponent(customer.nationalId)}`,
                    })
                  }
                >
                  <UserRound />
                  <span className="truncate">{customer.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{customer.telephone}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {cars.length > 0 && (
            <CommandGroup heading="Vehicles">
              {cars.map((car) => {
                const identifier = car.regNo ?? car.chassisNo ?? ""
                return (
                  <CommandItem
                    key={car.id}
                    value={`car-${car.id}`}
                    onSelect={() =>
                      go({
                        key: `car-${car.id}`,
                        kind: "car",
                        title: `${car.year} ${car.brand} ${car.name}`,
                        subtitle: identifier,
                        href: `/vehicles?q=${encodeURIComponent(identifier)}`,
                      })
                    }
                  >
                    <CarFront />
                    <span className="truncate">
                      {car.year} {car.brand} {car.name}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{identifier}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {upcoming.length > 0 && (
            <CommandGroup heading="Coming soon">
              {upcoming.map((item) => (
                <CommandItem key={item.href} value={`soon-${item.href}`} disabled>
                  <item.icon />
                  {item.title}
                  <span className="ml-auto text-xs">Being migrated</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>
              <CornerDownLeft />
            </Kbd>
            to select
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            to close
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
