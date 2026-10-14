"use client"

import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/page-header"

import { BrandingForm, type BrandingSource } from "./branding-form"

/** The dealership admin's own branding settings. */
export function SettingsView({ dealership }: { dealership: BrandingSource }) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Make the dashboard yours: your logo, title and colours." />
      <BrandingForm
        // Re-key on the server's timestamp so the form resets to what was saved.
        key={dealership.updatedAt}
        dealership={dealership}
        endpoints={{ settings: "/api/branding", logo: "/api/branding/logo", logoImage: `/api/dealerships/${dealership.id}/logo` }}
        // The layout (sidebar, colours, tab title) is rendered on the server, so ask it to render again.
        onChanged={() => router.refresh()}
      />
    </div>
  )
}
