import type { Metadata } from "next"

import { AdminOverviewView } from "@/features/admin/overview-view"

export const metadata: Metadata = { title: "Overview" }

export default function AdminOverviewPage() {
  return <AdminOverviewView />
}
