import { cookies } from "next/headers"

import { DialogHost } from "@/components/dialog-host"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { CommandMenu } from "@/components/shell/command-menu"
import { DealershipProvider } from "@/components/shell/dealership-context"
import { SiteHeader } from "@/components/shell/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { BillingBanner } from "@/features/billing/billing-banner"
import { billingStatus } from "@/features/billing/server"
import { PasswordReminder } from "@/features/auth/password-reminder"
import { requireDealerAdminPage } from "@/server/auth"

// The dealership admin's dashboard. Only a signed-in dealership admin gets in, and only to their own dealership.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireDealerAdminPage()
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  const { dealership } = user
  const billing = await billingStatus(dealership.id)
  const current = {
    id: dealership.id,
    code: dealership.code,
    name: dealership.name,
    city: dealership.city,
    title: dealership.brandTitle || dealership.name,
    logoUrl: dealership.logoKey ? `/api/dealerships/${dealership.id}/logo?v=${dealership.updatedAt.getTime()}` : null,
    logoWide: dealership.logoWide,
  }

  return (
    <DealershipProvider current={current}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={{ name: user.name, email: user.email, roleLabel: "Dealership admin" }} />
        <SidebarInset className="relative isolate min-w-0 overflow-clip">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(55%_100%_at_50%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent)]"
          />
          <SiteHeader />
          {user.mustChangePassword && <PasswordReminder />}
          <BillingBanner status={billing} />
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col p-4 md:p-6 lg:p-8">{children}</div>
        </SidebarInset>
        <CommandMenu />
        <DialogHost />
      </SidebarProvider>
    </DealershipProvider>
  )
}
