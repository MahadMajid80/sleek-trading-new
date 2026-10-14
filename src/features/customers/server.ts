import "server-only"

import { and, eq, exists, getTableColumns, gte, lte, not, or, sql } from "drizzle-orm"
import type { z } from "zod"

import { db } from "@/db"
import { agreements, customers, dealerships } from "@/db/schema"
import { allWordsMatch, dateParam, dealershipScope, enumListParam, parseListParams } from "@/server/list-params"

import type { customerSchema } from "./schema"

export const customerConstraintMessages = {
  customers_national_id_key: { field: "nationalId", message: "A customer with this National ID already exists" },
  customers_telephone_key: { field: "telephone", message: "A customer with this phone number already exists" },
  customers_email_key: { field: "email", message: "A customer with this email already exists" },
}

const sortable = {
  name: customers.name,
  nationalId: customers.nationalId,
  telephone: customers.telephone,
  kraPin: customers.kraPin,
  createdAt: customers.createdAt,
}

const hasAgreementsSql = exists(
  db
    .select({ one: sql`1` })
    .from(agreements)
    .where(or(eq(agreements.customerId, customers.id), eq(agreements.sellerId, customers.id))),
)

/** `scope`: the staff user's dealership, or `null` for the super admin. */
export async function listCustomers(scope: string | null, url: string) {
  const { perPage, offset, q, orderBy } = parseListParams(url, sortable, "createdAt.desc")
  const [deals] = enumListParam(url, "deals", ["with", "without"] as const)
  const from = dateParam(url, "from")
  const to = dateParam(url, "to")
  const where = and(
    dealershipScope(customers.dealershipId, scope, url),
    deals === "with" ? hasAgreementsSql : deals === "without" ? not(hasAgreementsSql) : undefined,
    from ? gte(sql`(${customers.createdAt} at time zone 'Africa/Nairobi')::date`, from) : undefined,
    to ? lte(sql`(${customers.createdAt} at time zone 'Africa/Nairobi')::date`, to) : undefined,
    q ? allWordsMatch(q, [customers.name, customers.telephone, customers.nationalId, customers.kraPin, customers.email]) : undefined,
  )

  const [rows, rowCount] = await Promise.all([
    db
      .select({
        ...getTableColumns(customers),
        dealershipCode: dealerships.code,
        dealershipName: dealerships.name,
        agreementCount: sql<number>`(select count(*) from ${agreements} where ${agreements.customerId} = ${customers.id} or ${agreements.sellerId} = ${customers.id})`.mapWith(Number),
      })
      .from(customers)
      .innerJoin(dealerships, eq(dealerships.id, customers.dealershipId))
      .where(where)
      .orderBy(orderBy, customers.id)
      .limit(perPage)
      .offset(offset),
    db.$count(customers, where),
  ])
  return { rows, rowCount }
}

function toRecord(input: z.output<typeof customerSchema>) {
  return { ...input, email: input.email || null, poBox: input.poBox || null }
}

export async function createCustomer(dealershipId: string, input: z.output<typeof customerSchema>) {
  const [row] = await db.insert(customers).values({ ...toRecord(input), dealershipId }).returning()
  return row!
}

export async function updateCustomer(dealershipId: string, id: string, input: z.output<typeof customerSchema>) {
  const [row] = await db
    .update(customers)
    .set(toRecord(input))
    .where(and(eq(customers.id, id), eq(customers.dealershipId, dealershipId)))
    .returning()
  return row
}

export async function deleteCustomer(dealershipId: string, id: string) {
  const [row] = await db
    .delete(customers)
    .where(and(eq(customers.id, id), eq(customers.dealershipId, dealershipId)))
    .returning({ id: customers.id })
  return row
}
