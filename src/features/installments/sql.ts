import "server-only"

import { sql } from "drizzle-orm"

import { installments } from "@/db/schema"

// SQL mirrors of ledger.ts so filtering, sorting and totals can happen in Postgres. Keep the two in sync.
export const remainingSql = sql<number>`greatest(${installments.amount} + ${installments.carriedOver} - ${installments.carriedForward} - ${installments.paid}, 0)`

export const todaySql = sql`(now() at time zone 'Africa/Nairobi')::date`

export const isOpenSql = sql<boolean>`(${remainingSql} > 0)`
export const isOverdueSql = sql<boolean>`(${remainingSql} > 0 and ${installments.dueDate} < ${todaySql})`
