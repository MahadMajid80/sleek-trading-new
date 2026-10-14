import "server-only"

import { and, desc, eq, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/db"
import { agreements, cars, customers, dealerships } from "@/db/schema"

import { allWordsMatch } from "./list-params"

const LIMIT = 5
// word_similarity compares the query against the best-matching stretch of the text, so "subaro" finds "Subaru Forester".
const FUZZY_THRESHOLD = 0.45

const party = alias(customers, "party")

/** Staff global search, always within one dealership. */
export async function searchRecords(dealershipId: string, rawQuery: string) {
  const q = rawQuery.trim().slice(0, 100)
  if (q.length < 2) return { customers: [], cars: [], agreements: [] }
  const agreementNumber = /^([a-z]{2,5}-?)?(\d{1,7})$/i.exec(q)?.[2]

  const carTitle = sql<string>`(${cars.brand} || ' ' || ${cars.name})`
  const customerFields = [customers.name, customers.telephone, customers.nationalId, customers.kraPin]
  const carFields = [carTitle, cars.regNo, cars.chassisNo]

  const customerExact = allWordsMatch(q, customerFields)
  const carExact = allWordsMatch(q, carFields)
  const customerFuzzy = sql<number>`word_similarity(${q}, ${customers.name})`
  const carFuzzy = sql<number>`word_similarity(${q}, ${carTitle})`

  const agreementRows = db
    .select({
      id: agreements.id,
      number: agreements.number,
      dealershipCode: dealerships.code,
      type: agreements.type,
      customerName: party.name,
      carTitle: sql<string>`${cars.year} || ' ' || ${cars.brand} || ' ' || ${cars.name}`,
    })
    .from(agreements)
    .innerJoin(dealerships, eq(dealerships.id, agreements.dealershipId))
    .innerJoin(cars, eq(cars.id, agreements.carId))
    .leftJoin(party, sql`${party.id} = coalesce(${agreements.customerId}, ${agreements.sellerId})`)
    .where(
      and(
        eq(agreements.dealershipId, dealershipId),
        agreementNumber
          ? sql`${agreements.number}::text like ${agreementNumber + "%"}`
          : or(allWordsMatch(q, [party.name]), sql`word_similarity(${q}, ${party.name}) >= ${FUZZY_THRESHOLD}`),
      ),
    )
    .orderBy(desc(agreements.number))
    .limit(LIMIT)

  const [customerRows, carRows, matchedAgreements] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        telephone: customers.telephone,
        nationalId: customers.nationalId,
      })
      .from(customers)
      .where(and(eq(customers.dealershipId, dealershipId), or(customerExact, sql`${customerFuzzy} >= ${FUZZY_THRESHOLD}`)))
      .orderBy(desc(sql`case when ${customerExact} then 1 else 0 end`), desc(customerFuzzy), customers.name)
      .limit(LIMIT),
    db
      .select({
        id: cars.id,
        brand: cars.brand,
        name: cars.name,
        year: cars.year,
        regNo: cars.regNo,
        chassisNo: cars.chassisNo,
      })
      .from(cars)
      .where(and(eq(cars.dealershipId, dealershipId), or(carExact, sql`${carFuzzy} >= ${FUZZY_THRESHOLD}`)))
      .orderBy(desc(sql`case when ${carExact} then 1 else 0 end`), desc(carFuzzy), desc(cars.year))
      .limit(LIMIT),
    agreementRows,
  ])

  return { customers: customerRows, cars: carRows, agreements: matchedAgreements }
}

export type SearchResults = Awaited<ReturnType<typeof searchRecords>>
