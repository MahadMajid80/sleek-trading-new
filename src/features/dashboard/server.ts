import "server-only"

import { and, asc, desc, eq, gte, inArray, notExists, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/db"
import { agreements, cars, customers, installments, payments } from "@/db/schema"
import { isOpenSql, isOverdueSql, remainingSql } from "@/features/installments/sql"

const MONTHS = 6

function monthBuckets(now = new Date()) {
  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - index), 1))
    return { key: date.toISOString().slice(0, 7), label: date.toLocaleString("en-KE", { month: "short", timeZone: "UTC" }) }
  })
}

const buyer = alias(customers, "buyer")
const party = alias(customers, "party")

/** Staff dashboard for one dealership. */
export async function getDashboardData(dealershipId: string) {
  const buckets = monthBuckets()
  const since = new Date(`${buckets[0]!.key}-01T00:00:00Z`)
  const sinceDate = `${buckets[0]!.key}-01`
  const monthStart = new Date(`${buckets.at(-1)!.key}-01T00:00:00Z`)
  const month = (column: AnyPgColumn | ReturnType<typeof sql>) =>
    sql<string>`to_char(date_trunc('month', ${column}), 'YYYY-MM')`

  const [
    customerCount,
    customersThisMonth,
    carsInStock,
    [hp],
    [money],
    collections,
    customerGrowth,
    needsAttention,
    recentAgreements,
  ] = await Promise.all([
    db.$count(customers, eq(customers.dealershipId, dealershipId)),
    db.$count(customers, and(eq(customers.dealershipId, dealershipId), gte(customers.createdAt, monthStart))),
    // In stock = not sold. Cars Sleek bought (buying agreements) or took as trade-ins stay in stock.
    db.$count(
      cars,
      and(
        eq(cars.dealershipId, dealershipId),
        notExists(
        db
          .select({ one: sql`1` })
          .from(agreements)
          .where(and(eq(agreements.carId, cars.id), inArray(agreements.type, ["cash_sale", "hire_purchase"]))),
        ),
      ),
    ),
    db
      .select({
        active: sql<number>`count(distinct ${installments.agreementId}) filter (where ${isOpenSql})`.mapWith(Number),
        behind: sql<number>`count(distinct ${installments.agreementId}) filter (where ${isOverdueSql})`.mapWith(Number),
      })
      .from(installments)
      .innerJoin(agreements, eq(agreements.id, installments.agreementId))
      .where(eq(agreements.dealershipId, dealershipId)),
    db
      .select({
        outstanding: sql<number>`coalesce(sum(${remainingSql}), 0)`.mapWith(Number),
        overdue: sql<number>`coalesce(sum(${remainingSql}) filter (where ${isOverdueSql}), 0)`.mapWith(Number),
      })
      .from(installments)
      .innerJoin(agreements, eq(agreements.id, installments.agreementId))
      .where(eq(agreements.dealershipId, dealershipId)),
    db
      .select({ month: month(payments.paidOn), total: sql<number>`sum(${payments.amount})`.mapWith(Number) })
      .from(payments)
      .innerJoin(agreements, eq(agreements.id, payments.agreementId))
      .where(and(eq(agreements.dealershipId, dealershipId), gte(payments.paidOn, sinceDate)))
      .groupBy(sql`1`),
    db
      .select({ month: month(sql`${customers.createdAt} at time zone 'Africa/Nairobi'`), count: sql<number>`count(*)`.mapWith(Number) })
      .from(customers)
      .where(and(eq(customers.dealershipId, dealershipId), gte(customers.createdAt, since)))
      .groupBy(sql`1`),
    db
      .select({
        installmentId: installments.id,
        agreementId: agreements.id,
        number: agreements.number,
        sequence: installments.sequence,
        dueDate: installments.dueDate,
        remaining: remainingSql.mapWith(Number),
        customerName: buyer.name,
        customerPhone: buyer.telephone,
      })
      .from(installments)
      .innerJoin(agreements, eq(agreements.id, installments.agreementId))
      .leftJoin(buyer, eq(buyer.id, agreements.customerId))
      .where(and(eq(agreements.dealershipId, dealershipId), isOverdueSql))
      .orderBy(asc(installments.dueDate))
      .limit(6),
    db
      .select({
        id: agreements.id,
        number: agreements.number,
        type: agreements.type,
        agreedPrice: agreements.agreedPrice,
        createdAt: agreements.createdAt,
        customerName: party.name,
        carTitle: sql<string>`${cars.year} || ' ' || ${cars.brand} || ' ' || ${cars.name}`,
      })
      .from(agreements)
      .innerJoin(cars, eq(cars.id, agreements.carId))
      .leftJoin(party, sql`${party.id} = coalesce(${agreements.customerId}, ${agreements.sellerId})`)
      .where(eq(agreements.dealershipId, dealershipId))
      .orderBy(desc(agreements.createdAt))
      .limit(6),
  ])

  const valueFor = <T extends { month: string }>(rows: T[], key: string, pick: (row: T) => number) =>
    pick(rows.find((row) => row.month === key) ?? ({} as T)) || 0

  return {
    stats: {
      customerCount,
      customersThisMonth,
      carsInStock,
      activeHp: hp?.active ?? 0,
      hpBehind: hp?.behind ?? 0,
      outstanding: money?.outstanding ?? 0,
      overdue: money?.overdue ?? 0,
      collectedThisMonth: valueFor(collections, buckets.at(-1)!.key, (row) => row.total),
    },
    trend: buckets.map((bucket) => ({
      month: bucket.label,
      collected: valueFor(collections, bucket.key, (row) => row.total),
      customers: valueFor(customerGrowth, bucket.key, (row) => row.count),
    })),
    needsAttention,
    recentAgreements,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
