import type { Metadata } from "next"

import { BankAccountsView } from "@/features/bank-accounts/bank-accounts-view"

export const metadata: Metadata = { title: "Bank accounts" }

export default function BankAccountsPage() {
  return <BankAccountsView />
}
