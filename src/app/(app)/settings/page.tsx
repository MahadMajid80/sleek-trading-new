import type { Metadata } from "next"

import { SettingsView } from "@/features/branding/settings-view"
import { requireDealerAdminPage } from "@/server/auth"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const { dealership } = await requireDealerAdminPage()
  return (
    <SettingsView
      dealership={{
        id: dealership.id,
        name: dealership.name,
        brandTitle: dealership.brandTitle,
        sidebarColor: dealership.sidebarColor,
        accentColor: dealership.accentColor,
        hasLogo: Boolean(dealership.logoKey),
        logoWide: dealership.logoWide,
        updatedAt: dealership.updatedAt.toISOString(),
      }}
    />
  )
}
