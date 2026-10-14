"use client"

import { createResource } from "@/lib/resource"

import type { BankAccountFormValues, BankAccountRow } from "./schema"

export const bankAccountsResource = createResource<BankAccountRow, BankAccountFormValues>("bank-accounts", "/api/bank-accounts")
