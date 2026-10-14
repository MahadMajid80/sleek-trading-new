import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LoginView } from "@/features/auth/login-view"
import { getCurrentUser } from "@/server/auth"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(user.role === "super_admin" ? "/admin" : "/")
  return <LoginView />
}
