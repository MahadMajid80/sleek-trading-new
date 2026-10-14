import { z } from "zod"

import type { BankAccount } from "@/db/schema"
import type { Jsonify } from "@/lib/types"

export const bankAccountSchema = z.object({
  title: z.string().trim().min(1, "Account title is required").max(80),
  bankName: z.string().trim().min(1, "Bank is required").max(60),
  branchName: z.union([z.literal(""), z.string().trim().max(60)]),
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required")
    .regex(/^[0-9A-Za-z-]{5,40}$/, "Use 5–40 digits or letters (dashes allowed)"),
})

export type BankAccountFormValues = z.input<typeof bankAccountSchema>
export type BankAccountRow = Jsonify<BankAccount>

export const emptyBankAccount: BankAccountFormValues = { title: "", bankName: "", branchName: "", accountNumber: "" }

export const toBankAccountFormValues = (account: BankAccountRow): BankAccountFormValues => ({
  title: account.title,
  bankName: account.bankName,
  branchName: account.branchName ?? "",
  accountNumber: account.accountNumber,
})

export const bankAccountLabel = (account: Pick<BankAccountRow, "bankName" | "accountNumber">) =>
  `${account.bankName} · ${account.accountNumber}`
