import "server-only"

import { and, eq } from "drizzle-orm"
import type { z } from "zod"

import { db } from "@/db"
import { bankAccounts } from "@/db/schema"
import { allWordsMatch, parseListParams } from "@/server/list-params"

import type { bankAccountSchema } from "./schema"

type Input = z.output<typeof bankAccountSchema>

export const bankAccountConstraintMessages = {
  bank_accounts_bank_account_number_key: {
    field: "accountNumber",
    message: "This account number already exists for this bank",
  },
}

const sortable = {
  title: bankAccounts.title,
  bankName: bankAccounts.bankName,
  createdAt: bankAccounts.createdAt,
}

export async function listBankAccounts(dealershipId: string, url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(url, sortable, "title.asc")
  const where = and(
    eq(bankAccounts.dealershipId, dealershipId),
    q ? allWordsMatch(q, [bankAccounts.title, bankAccounts.bankName, bankAccounts.branchName, bankAccounts.accountNumber]) : undefined,
  )
  const [rows, rowCount] = await Promise.all([
    db.select().from(bankAccounts).where(where).orderBy(orderBy, bankAccounts.id).limit(perPage).offset(offset),
    db.$count(bankAccounts, where),
  ])
  return { rows, rowCount }
}

const toRecord = (input: Input) => ({ ...input, branchName: input.branchName || null })

export async function createBankAccount(dealershipId: string, input: Input) {
  const [row] = await db.insert(bankAccounts).values({ ...toRecord(input), dealershipId }).returning()
  return row!
}

export async function updateBankAccount(dealershipId: string, id: string, input: Input) {
  const [row] = await db
    .update(bankAccounts)
    .set(toRecord(input))
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.dealershipId, dealershipId)))
    .returning()
  return row
}

export async function deleteBankAccount(dealershipId: string, id: string) {
  const [row] = await db
    .delete(bankAccounts)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.dealershipId, dealershipId)))
    .returning({ id: bankAccounts.id })
  return row
}
