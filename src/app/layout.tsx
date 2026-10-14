import type { Metadata } from "next"
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { headers } from "next/headers"

import { brandStyle } from "@/features/branding/theme"
import { getCurrentUser } from "@/server/auth"

import { Providers } from "./providers"
import "./globals.css"

// Plus Jakarta Sans for all text and headings (bold), matching the brand website.
// Mono: JetBrains Mono only for number plates, IDs and agreement numbers.
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] })
const mono = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] })

// A dealership admin sees their own dashboard title in the browser tab; everyone else sees the platform name.
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser()
  const name = user?.role === "dealer_admin" && user.dealership ? user.dealership.brandTitle || user.dealership.name : "AutoVault"
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Vehicle sales, hire purchase and finance management for dealerships.",
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const area = (await headers()).get("x-sleek-area")
  const user = await getCurrentUser()
  // Dealership colours are applied on <html> so dialogs and menus (rendered in portals) pick them up too.
  const style = user?.role === "dealer_admin" ? brandStyle(user.dealership) : undefined
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={style}
      className={`${sans.variable} ${mono.variable} h-full antialiased ${area === "admin" ? "admin" : ""}`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
