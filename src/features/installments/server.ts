import "server-only"

import { and, count, eq, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/db"
import { agreements, cars, customers, dealerships, installments } from "@/db/schema"
import { allWordsMatch, dealershipScope, parseListParams } from "@/server/list-params"

import { installmentStatus } from "./ledger"
import { isOpenSql, isOverdueSql, remainingSql, todaySql } from "./sql"

export const INSTALLMENT_FILTERS = ["overdue", "due-soon", "open", "settled", "all"] as const
export type InstallmentFilter = (typeof INSTALLMENT_FILTERS)[number]

const dueSoonSql = sql<boolean>`(${isOpenSql} and ${installments.dueDate} between ${todaySql} and ${todaySql} + 7)`

const filterSql: Record<InstallmentFilter, SQL | undefined> = {
  overdue: isOverdueSql,
  "due-soon": dueSoonSql,
  open: isOpenSql,
  settled: sql`not ${isOpenSql}`,
  all: undefined,
}

const buyer = alias(customers, "buyer")

const sortable = {
  dueDate: installments.dueDate,
  amount: installments.amount,
  remaining: remainingSql,
  number: agreements.number,
}

/** `scope`: the staff user's dealership, or `null` for the super admin. */
export async function listInstallments(scope: string | null, url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(url, sortable, "dueDate.asc")
  const filterParam = new URL(url).searchParams.get("filter")
  const filter = INSTALLMENT_FILTERS.includes(filterParam as InstallmentFilter) ? (filterParam as InstallmentFilter) : "open"

  const where = and(
    dealershipScope(agreements.dealershipId, scope, url),
    filterSql[filter],
    q
      ? allWordsMatch(q.replace(/^[a-z]{2,5}-(?=\d)/i, ""), [
          sql`${agreements.number}::text`,
          buyer.name,
          buyer.telephone,
          sql`(${cars.brand} || ' ' || ${cars.name})`,
          cars.regNo,
        ])
      : undefined,
  )

  const base = <T extends Record<string, unknown>>(fields: T) =>
    db
      .select(fields as never)
      .from(installments)
      .innerJoin(agreements, eq(agreements.id, installments.agreementId))
      .innerJoin(dealerships, eq(dealerships.id, agreements.dealershipId))
      .innerJoin(cars, eq(cars.id, agreements.carId))
      .leftJoin(buyer, eq(buyer.id, agreements.customerId))
      .where(where)

  const [rows, [total]] = await Promise.all([
    base({
      id: installments.id,
      agreementId: agreements.id,
      agreementNumber: agreements.number,
      dealershipCode: dealerships.code,
      dealershipName: dealerships.name,
      sequence: installments.sequence,
      totalInstallments: sql<number>`(select count(*) from ${installments} i2 where i2.agreement_id = ${agreements.id})`.mapWith(Number),
      dueDate: installments.dueDate,
      amount: installments.amount,
      paid: installments.paid,
      carriedOver: installments.carriedOver,
      carriedForward: installments.carriedForward,
      customerName: buyer.name,
      customerPhone: buyer.telephone,
      carTitle: sql<string>`${cars.year} || ' ' || ${cars.brand} || ' ' || ${cars.name}`,
      carRegNo: cars.regNo,
    })
      .orderBy(orderBy, agreements.number, installments.sequence)
      .limit(perPage)
      .offset(offset) as Promise<InstallmentRowBase[]>,
    base({ value: count() }) as Promise<{ value: number }[]>,
  ])

  return {
    rows: rows.map((row) => ({ ...row, status: installmentStatus(row) })),
    rowCount: total?.value ?? 0,
  }
}

type InstallmentRowBase = {
  id: string
  agreementId: string
  agreementNumber: number
  dealershipCode: string
  dealershipName: string
  sequence: number
  totalInstallments: number
  dueDate: string
  amount: number
  paid: number
  carriedOver: number
  carriedForward: number
  customerName: string | null
  customerPhone: string | null
  carTitle: string
  carRegNo: string | null
}

export async function installmentTotals(scope: string | null) {
  const [row] = await db
    .select({
      overdueAmount: sql<number>`coalesce(sum(${remainingSql}) filter (where ${isOverdueSql}), 0)`.mapWith(Number),
      overdueCount: sql<number>`count(*) filter (where ${isOverdueSql})`.mapWith(Number),
      dueSoonAmount: sql<number>`coalesce(sum(${remainingSql}) filter (where ${dueSoonSql}), 0)`.mapWith(Number),
      dueSoonCount: sql<number>`count(*) filter (where ${dueSoonSql})`.mapWith(Number),
      outstanding: sql<number>`coalesce(sum(${remainingSql}), 0)`.mapWith(Number),
    })
    .from(installments)
    .innerJoin(agreements, eq(agreements.id, installments.agreementId))
    .where(scope ? eq(agreements.dealershipId, scope) : undefined)
  return row!
}
