import "server-only"

import { and, eq, exists, getTableColumns, gte, inArray, lte, not, sql } from "drizzle-orm"

import { db } from "@/db"
import { agreements, cars, dealerships } from "@/db/schema"
import { allWordsMatch, dealershipScope, enumListParam, listParam, numberParam, parseListParams } from "@/server/list-params"

import type { CarInput } from "./schema"

export const carConstraintMessages = {
  cars_chassis_no_key: { field: "chassisNo", message: "A vehicle with this Chassis No already exists" },
  cars_reg_no_key: { field: "regNo", message: "A vehicle with this Registration No already exists" },
}

const sortable = {
  brand: cars.brand,
  year: cars.year,
  regNo: cars.regNo,
  cc: cars.cc,
  createdAt: cars.createdAt,
}

// A car is sold once a cash sale or hire purchase agreement uses it; bought and traded-in cars stay in stock.
export const soldSql = exists(
  db
    .select({ one: sql`1` })
    .from(agreements)
    .where(and(eq(agreements.carId, cars.id), inArray(agreements.type, ["cash_sale", "hire_purchase"]))),
)

export function carFilters(url: string) {
  const brands = listParam(url, "brand")
  const bodies = listParam(url, "body")
  const [stock] = enumListParam(url, "stock", ["in_stock", "sold"] as const)
  const yearFrom = numberParam(url, "yearFrom")
  const yearTo = numberParam(url, "yearTo")
  return and(
    brands.length ? inArray(cars.brand, brands) : undefined,
    bodies.length ? inArray(cars.bodyType, bodies) : undefined,
    yearFrom !== undefined ? gte(cars.year, yearFrom) : undefined,
    yearTo !== undefined ? lte(cars.year, yearTo) : undefined,
    stock === "sold" ? soldSql : stock === "in_stock" ? not(soldSql) : undefined,
  )
}

/** Distinct values with counts, for the filter dropdowns. */
export async function carFacets(dealershipId?: string) {
  const scope = dealershipId ? eq(cars.dealershipId, dealershipId) : undefined
  const [brands, bodies] = await Promise.all([
    db.select({ value: cars.brand, count: sql<number>`count(*)`.mapWith(Number) }).from(cars).where(scope).groupBy(cars.brand).orderBy(cars.brand),
    db.select({ value: cars.bodyType, count: sql<number>`count(*)`.mapWith(Number) }).from(cars).where(scope).groupBy(cars.bodyType).orderBy(cars.bodyType),
  ])
  return { brands, bodies }
}

/** `scope`: the staff user's dealership, or `null` for the super admin. */
export async function listCars(scope: string | null, url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(url, sortable, "createdAt.desc")
  const where = and(
    dealershipScope(cars.dealershipId, scope, url),
    carFilters(url),
    q
    ? allWordsMatch(q, [
        sql`(${cars.brand} || ' ' || ${cars.name})`,
        cars.regNo,
        cars.chassisNo,
        cars.engineNo,
        cars.color,
        cars.bodyType,
      ])
    : undefined,
  )

  const [rows, rowCount] = await Promise.all([
    db
      .select({
        ...getTableColumns(cars),
        sold: sql<boolean>`${soldSql}`,
        dealershipCode: dealerships.code,
        dealershipName: dealerships.name,
      })
      .from(cars)
      .innerJoin(dealerships, eq(dealerships.id, cars.dealershipId))
      .where(where)
      .orderBy(orderBy, cars.id)
      .limit(perPage)
      .offset(offset),
    db.$count(cars, where),
  ])
  return { rows, rowCount }
}

function toRecord(input: CarInput) {
  return {
    ...input,
    chassisNo: input.chassisNo || null,
    engineNo: input.engineNo || null,
    regNo: input.regNo || null,
  }
}

export async function createCar(dealershipId: string, input: CarInput) {
  const [row] = await db.insert(cars).values({ ...toRecord(input), dealershipId }).returning()
  return row!
}

export async function updateCar(dealershipId: string, id: string, input: CarInput) {
  const [row] = await db
    .update(cars)
    .set(toRecord(input))
    .where(and(eq(cars.id, id), eq(cars.dealershipId, dealershipId)))
    .returning()
  return row
}

export async function deleteCar(dealershipId: string, id: string) {
  const [row] = await db
    .delete(cars)
    .where(and(eq(cars.id, id), eq(cars.dealershipId, dealershipId)))
    .returning({ id: cars.id })
  return row
}
