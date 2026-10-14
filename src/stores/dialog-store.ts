import { create } from "zustand"

import type { BankAccountRow } from "@/features/bank-accounts/schema"
import type { CarRow } from "@/features/cars/schema"
import type { CustomerRow } from "@/features/customers/schema"
import type { InvoiceRow } from "@/features/invoices/queries"
import type { InvoiceKind } from "@/features/invoices/schema"

export type ActiveDialog =
  | { type: "customer-form"; customer?: CustomerRow }
  | { type: "car-form"; car?: CarRow }
  | { type: "bank-account-form"; account?: BankAccountRow }
  | { type: "invoice-form"; kind: InvoiceKind; invoice?: InvoiceRow }

type DialogStore = {
  /** Kept after closing so the dialog's content stays put during its exit animation. */
  dialog: ActiveDialog | null
  isOpen: boolean
  /** Bumped on every open; used as a React key so each open starts with a fresh form. */
  session: number
  open: (dialog: ActiveDialog) => void
  close: () => void
}

// Forms are hosted once at the app shell so any page, row action or ⌘K command can open them.
export const useDialogStore = create<DialogStore>()((set) => ({
  dialog: null,
  isOpen: false,
  session: 0,
  open: (dialog) => set((state) => ({ dialog, isOpen: true, session: state.session + 1 })),
  close: () => set({ isOpen: false }),
}))
