import type { Metadata } from "next"
import { cookies } from "next/headers"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AdminDialogHost } from "@/features/admin/ui/admin-dialogs"
import { AdminHeader, AdminSidebar, CommandBackdrop } from "@/features/admin/ui/admin-shell"
import { AdminAreaTheme } from "@/features/admin/ui/area-theme"
import { requireSuperAdminPage } from "@/server/auth"

export const metadata: Metadata = { title: { default: "Super admin · AutoVault", template: "%s · Super admin · AutoVault" } }

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireSuperAdminPage()
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminAreaTheme />
      <AdminSidebar user={{ name: user.name, email: user.email, roleLabel: "Super admin" }} />
      <SidebarInset className="relative isolate min-w-0 overflow-clip">
        <CommandBackdrop />
        <AdminHeader />
        <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-1 flex-col p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
      <AdminDialogHost />
    </SidebarProvider>
  )
}
