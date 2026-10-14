import "server-only"

import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/db"
import { agreements, cars, customers, dealerships, installments, payments } from "@/db/schema"
import { isOpenSql, isOverdueSql, remainingSql } from "@/features/installments/sql"
import { allWordsMatch, enumListParam, listParam, parseListParams } from "@/server/list-params"

// Super admin: platform-wide reads across every dealership, plus dealership management.

const MONTHS = 6

function monthBuckets(now = new Date()) {
  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - index), 1))
    return { key: date.toISOString().slice(0, 7), label: date.toLocaleString("en-KE", { month: "short", timeZone: "UTC" }) }
  })
}

const monthStartSql = sql`date_trunc('month', (now() at time zone 'Africa/Nairobi'))::date`
const soldCar = (carId: typeof cars.id) =>
  db
    .select({ one: sql`1` })
    .from(agreements)
    .where(and(eq(agreements.carId, carId), inArray(agreements.type, ["cash_sale", "hire_purchase"])))

/** Per-dealership metrics, used by the overview leaderboard and the dealerships table. */
export function dealershipMetrics() {
  const perCustomers = db
    .select({ dealershipId: customers.dealershipId, value: count().as("customer_count") })
    .from(customers)
    .groupBy(customers.dealershipId)
    .as("c")
  const perCars = db
    .select({
      dealershipId: cars.dealershipId,
      total: count().as("car_count"),
      inStock: sql<number>`count(*) filter (where not exists (${soldCar(cars.id)}))`.mapWith(Number).as("in_stock"),
    })
    .from(cars)
    .groupBy(cars.dealershipId)
    .as("v")
  const perAgreements = db
    .select({ dealershipId: agreements.dealershipId, value: count().as("agreement_count") })
    .from(agreements)
    .groupBy(agreements.dealershipId)
    .as("a")
  const perMoney = db
    .select({
      dealershipId: agreements.dealershipId,
      outstanding: sql<number>`coalesce(sum(${remainingSql}), 0)`.mapWith(Number).as("outstanding"),
      overdue: sql<number>`coalesce(sum(${remainingSql}) filter (where ${isOverdueSql}), 0)`.mapWith(Number).as("overdue"),
      activeHp: sql<number>`count(distinct ${installments.agreementId}) filter (where ${isOpenSql})`.mapWith(Number).as("active_hp"),
    })
    .from(installments)
    .innerJoin(agreements, eq(agreements.id, installments.agreementId))
    .groupBy(agreements.dealershipId)
    .as("m")
  const perCollections = db
    .select({
      dealershipId: agreements.dealershipId,
      thisMonth: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.paidOn} >= ${monthStartSql}), 0)`.mapWith(Number).as("this_month"),
      allTime: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number).as("all_time"),
      lastPaymentOn: sql<string | null>`max(${payments.paidOn})`.as("last_payment_on"),
    })
    .from(payments)
    .innerJoin(agreements, eq(agreements.id, payments.agreementId))
    .groupBy(agreements.dealershipId)
    .as("p")

  return db
    .select({
      id: dealerships.id,
      code: dealerships.code,
      name: dealerships.name,
      city: dealerships.city,
      country: dealerships.country,
      phone: dealerships.phone,
      email: dealerships.email,
      status: dealerships.status,
      createdAt: dealerships.createdAt,
      updatedAt: dealerships.updatedAt,
      brandTitle: dealerships.brandTitle,
      hasLogo: sql<boolean>`${dealerships.logoKey} is not null`,
      logoWide: dealerships.logoWide,
      sidebarColor: dealerships.sidebarColor,
      accentColor: dealerships.accentColor,
      customers: sql<number>`coalesce(${perCustomers.value}, 0)`.mapWith(Number),
      cars: sql<number>`coalesce(${perCars.total}, 0)`.mapWith(Number),
      carsInStock: sql<number>`coalesce(${perCars.inStock}, 0)`.mapWith(Number),
      agreements: sql<number>`coalesce(${perAgreements.value}, 0)`.mapWith(Number),
      activeHp: sql<number>`coalesce(${perMoney.activeHp}, 0)`.mapWith(Number),
      outstanding: sql<number>`coalesce(${perMoney.outstanding}, 0)`.mapWith(Number),
      overdue: sql<number>`coalesce(${perMoney.overdue}, 0)`.mapWith(Number),
      collectedThisMonth: sql<number>`coalesce(${perCollections.thisMonth}, 0)`.mapWith(Number),
      collectedAllTime: sql<number>`coalesce(${perCollections.allTime}, 0)`.mapWith(Number),
      lastPaymentOn: perCollections.lastPaymentOn,
    })
    .from(dealerships)
    .leftJoin(perCustomers, eq(perCustomers.dealershipId, dealerships.id))
    .leftJoin(perCars, eq(perCars.dealershipId, dealerships.id))
    .leftJoin(perAgreements, eq(perAgreements.dealershipId, dealerships.id))
    .leftJoin(perMoney, eq(perMoney.dealershipId, dealerships.id))
    .leftJoin(perCollections, eq(perCollections.dealershipId, dealerships.id))
}

export type DealershipWithMetrics = Awaited<ReturnType<typeof listDealerships>>["rows"][number]

export async function listDealerships(url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(
    url,
    {
      name: dealerships.name,
      city: dealerships.city,
      country: dealerships.country,
      phone: dealerships.phone,
      createdAt: dealerships.createdAt,
    },
    "createdAt.desc",
  )
  const statuses = enumListParam(url, "status", ["active", "suspended"] as const)
  const countries = listParam(url, "country")
  const where = and(
    statuses.length ? inArray(dealerships.status, statuses) : undefined,
    countries.length ? inArray(dealerships.country, countries) : undefined,
    q ? allWordsMatch(q, [dealerships.name, dealerships.city, dealerships.phone, dealerships.email]) : undefined,
  )
  const [rows, rowCount] = await Promise.all([
    dealershipMetrics().where(where).orderBy(orderBy, dealerships.id).limit(perPage).offset(offset),
    db.$count(dealerships, where),
  ])
  return { rows, rowCount }
}

export async function dealershipOptions() {
  return db
    .select({ id: dealerships.id, code: dealerships.code, name: dealerships.name, city: dealerships.city, country: dealerships.country, status: dealerships.status })
    .from(dealerships)
    .orderBy(asc(dealerships.createdAt), asc(dealerships.code))
}

const topOverdueBuyer = alias(customers, "overdue_buyer")

export async function getPlatformOverview() {
  const buckets = monthBuckets()
  const sinceDate = `${buckets[0]!.key}-01`

  const [perDealership, trendRows, mix, topOverdue, [totals]] = await Promise.all([
    dealershipMetrics().orderBy(asc(dealerships.createdAt)),
    db
      .select({
        dealershipId: agreements.dealershipId,
        month: sql<string>`to_char(date_trunc('month', ${payments.paidOn}), 'YYYY-MM')`,
        total: sql<number>`sum(${payments.amount})`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(agreements, eq(agreements.id, payments.agreementId))
      .where(gte(payments.paidOn, sinceDate))
      .groupBy(agreements.dealershipId, sql`2`),
    db
      .select({ type: agreements.type, count: count(), value: sql<number>`sum(${agreements.agreedPrice})`.mapWith(Number) })
      .from(agreements)
      .groupBy(agreements.type),
    db
      .select({
        installmentId: installments.id,
        agreementId: agreements.id,
        number: agreements.number,
        dealershipCode: dealerships.code,
        dealershipName: dealerships.name,
        dueDate: installments.dueDate,
        remaining: remainingSql.mapWith(Number),
        customerName: topOverdueBuyer.name,
        customerPhone: topOverdueBuyer.telephone,
      })
      .from(installments)
      .innerJoin(agreements, eq(agreements.id, installments.agreementId))
      .innerJoin(dealerships, eq(dealerships.id, agreements.dealershipId))
      .leftJoin(topOverdueBuyer, eq(topOverdueBuyer.id, agreements.customerId))
      .where(isOverdueSql)
      .orderBy(asc(installments.dueDate), desc(remainingSql))
      .limit(6),
    db
      .select({
        customers: sql<number>`(select count(*) from ${customers})`.mapWith(Number),
        cars: sql<number>`(select count(*) from ${cars})`.mapWith(Number),
        carsInStock: sql<number>`(select count(*) from ${cars} where not exists (${soldCar(cars.id)}))`.mapWith(Number),
        agreements: sql<number>`(select count(*) from ${agreements})`.mapWith(Number),
        customersThisMonth: sql<number>`(select count(*) from ${customers} where ${customers.createdAt} >= ${monthStartSql})`.mapWith(Number),
      })
      .from(sql`(select 1) as one`),
  ])

  const sum = (key: "outstanding" | "overdue" | "collectedThisMonth" | "activeHp") =>
    perDealership.reduce((total, row) => total + row[key], 0)

  return {
    totals: {
      ...totals!,
      dealerships: perDealership.length,
      activeDealerships: perDealership.filter((d) => d.status === "active").length,
      outstanding: sum("outstanding"),
      overdue: sum("overdue"),
      collectedThisMonth: sum("collectedThisMonth"),
      activeHp: sum("activeHp"),
    },
    dealerships: perDealership,
    trend: buckets.map((bucket) => ({
      month: bucket.label,
      ...Object.fromEntries(
        perDealership.map((d) => [
          d.code,
          trendRows.find((row) => row.dealershipId === d.id && row.month === bucket.key)?.total ?? 0,
        ]),
      ),
    })),
    mix,
    topOverdue,
  }
}

export type PlatformOverview = Awaited<ReturnType<typeof getPlatformOverview>>
