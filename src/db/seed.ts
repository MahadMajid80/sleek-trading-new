import { config } from "dotenv"

import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"

import { addMonths, format } from "date-fns"
import { eq, sql } from "drizzle-orm"

import { buildSchedule, planPayment, todayISO, type InstallmentAmounts } from "../features/installments/ledger"

import { createDatabase, type Database } from "./client"
import { seedBilling } from "./seed-billing"
import { seedBranding, seedUsers } from "./seed-users"
import {
  agreements,
  agreementTradeIns,
  bankAccounts,
  billingPlans,
  cars,
  customers,
  dealerships,
  finalInvoices,
  installments,
  paymentAllocations,
  payments,
  proformaInvoices,
  type NewCar,
  type NewCustomer,
  users,
} from "./schema"

config({ path: [".env.local", ".env"], quiet: true })

// Deterministic PRNG so every developer gets the same sample data.
let state = 20250929
const random = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32
  return state / 2 ** 32
}
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]!
const digits = (length: number) => Array.from({ length }, () => Math.floor(random() * 10)).join("")
const letter = () => String.fromCharCode(65 + Math.floor(random() * 26))

const FIRST = ["Wanjiku", "Kamau", "Achieng", "Otieno", "Njeri", "Mwangi", "Akinyi", "Kiprono", "Wambui", "Omondi", "Chebet", "Mutua", "Nyambura", "Kariuki", "Atieno", "Kiptoo", "Muthoni", "Onyango", "Jeptoo", "Macharia", "Faith", "Brian", "Mercy", "Kevin", "Grace", "Dennis", "Esther", "Collins", "Joy", "Victor"]
const LAST = ["Kamau", "Odhiambo", "Wanjiru", "Kipchoge", "Mutiso", "Ochieng", "Njoroge", "Kiplagat", "Wairimu", "Owino", "Kibet", "Nduta", "Maina", "Adhiambo", "Rotich", "Gitau", "Nyongesa", "Wekesa", "Chege", "Koech"]
const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com"]
const CARS: [brand: string, name: string, type: string, cc: number][] = [
  ["Toyota", "Axio", "Sedan", 1500],
  ["Toyota", "Fielder", "Station Wagon", 1500],
  ["Toyota", "Premio", "Sedan", 1800],
  ["Toyota", "Harrier", "SUV", 2000],
  ["Toyota", "Land Cruiser Prado", "SUV", 2800],
  ["Toyota", "Vitz", "Hatchback", 1000],
  ["Nissan", "Note", "Hatchback", 1200],
  ["Nissan", "X-Trail", "SUV", 2000],
  ["Nissan", "Navara", "Pickup", 2500],
  ["Mazda", "Demio", "Hatchback", 1300],
  ["Mazda", "CX-5", "SUV", 2200],
  ["Subaru", "Forester", "SUV", 2000],
  ["Subaru", "Outback", "Station Wagon", 2500],
  ["Honda", "Fit", "Hatchback", 1300],
  ["Honda", "Vezel", "SUV", 1500],
  ["Mercedes-Benz", "C200", "Sedan", 1800],
  ["Volkswagen", "Golf", "Hatchback", 1400],
  ["Isuzu", "D-Max", "Pickup", 2500],
]
const COLORS = ["Pearl White", "Silver", "Black", "Grey", "Blue", "Maroon", "Wine Red", "Champagne", "Navy Blue", "Green"]

function daysAgo(max: number) {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(random() ** 1.6 * max))
  date.setHours(8 + Math.floor(random() * 10), Math.floor(random() * 60))
  return date
}

function makeCustomers(dealershipId: string, count: number): NewCustomer[] {
  const seen = new Set<string>()
  const rows: NewCustomer[] = []
  while (rows.length < count) {
    const first = pick(FIRST)
    const last = pick(LAST)
    const nationalId = digits(8).replace(/^0/, "2")
    const telephone = `07${digits(8)}`
    if (seen.has(nationalId) || seen.has(telephone)) continue
    seen.add(nationalId).add(telephone)
    const createdAt = daysAgo(200)
    rows.push({
      dealershipId,
      name: `${first} ${last}`,
      nationalId,
      telephone,
      email: random() < 0.7 ? `${first}.${last}${rows.length}@${pick(DOMAINS)}`.toLowerCase() : null,
      kraPin: `${pick(["A", "P"])}${digits(9)}${letter()}`,
      poBox: random() < 0.5 ? `${digits(3)}-${digits(5)}` : null,
      createdAt,
      updatedAt: createdAt,
    })
  }
  return rows
}

function makeCars(dealershipId: string, count: number): NewCar[] {
  const seen = new Set<string>()
  const rows: NewCar[] = []
  while (rows.length < count) {
    const [brand, name, bodyType, cc] = pick(CARS)
    const regNo = `K${pick(["C", "D"])}${letter()}${digits(3)}${letter()}`
    const chassisNo = `${name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}${digits(2)}-${digits(7)}`
    if (seen.has(regNo) || seen.has(chassisNo)) continue
    seen.add(regNo).add(chassisNo)
    const createdAt = daysAgo(200)
    rows.push({
      dealershipId,
      brand,
      name,
      bodyType,
      year: 2010 + Math.floor(random() * 14),
      chassisNo,
      engineNo: random() < 0.8 ? `${letter()}${digits(1)}${letter()}${letter()}-${digits(6)}` : null,
      regNo: random() < 0.85 ? regNo : null,
      color: pick(COLORS),
      cc,
      createdAt,
      updatedAt: createdAt,
    })
  }
  return rows
}

// A tiny valid PDF so seeded payments have a downloadable receipt.
const SAMPLE_RECEIPT_KEY = "receipts/seed/sample-receipt.pdf"
function writeSampleReceipt() {
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 60>>stream
BT /F1 16 Tf 40 70 Td (Sample M-Pesa receipt) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`
  mkdirSync("./.data/uploads/receipts/seed", { recursive: true })
  writeFileSync(`./.data/uploads/${SAMPLE_RECEIPT_KEY}`, pdf)
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step

let nextAgreementNumber = 1001

async function seedDeals(
  db: Database,
  dealershipId: string,
  mix: { hp: number; cash: number; buying: number; invoices: number },
) {
  const people = await db.select({ id: customers.id }).from(customers).where(eq(customers.dealershipId, dealershipId))
  const fleet = await db.select({ id: cars.id }).from(cars).where(eq(cars.dealershipId, dealershipId))
  const accounts = await db.select({ id: bankAccounts.id }).from(bankAccounts).where(eq(bankAccounts.dealershipId, dealershipId))
  const shuffledPeople = [...people].sort(() => random() - 0.5)
  let personIndex = 0
  const nextPerson = () => shuffledPeople[personIndex++ % shuffledPeople.length]!.id
  const today = todayISO()
  let carIndex = 0
  const nextCar = () => fleet[carIndex++]!.id

  const plan = [
    ...Array.from({ length: mix.hp }, () => "hire_purchase" as const),
    ...Array.from({ length: mix.cash }, () => "cash_sale" as const),
    ...Array.from({ length: mix.buying }, () => "buying" as const),
  ]

  let paymentCount = 0
  for (const type of plan) {
    const agreedPrice = roundTo(700_000 + random() * 2_800_000, 5_000)
    const deposit = type === "hire_purchase" ? roundTo(agreedPrice * (0.25 + random() * 0.25), 5_000) : type === "cash_sale" ? agreedPrice : roundTo(agreedPrice * 0.5, 5_000)
    const monthsAgo = type === "hire_purchase" ? 1 + Math.floor(random() * 9) : Math.floor(random() * 6)
    const createdAt = addMonths(new Date(), -monthsAgo)
    const startingDate = format(addMonths(createdAt, 1), "yyyy-MM-01")
    const duration = [6, 12, 12, 18, 24][Math.floor(random() * 5)]!
    const hasTradeIn = type !== "hire_purchase" ? random() < 0.35 : random() < 0.15

    const [agreement] = await db
      .insert(agreements)
      .values({
        dealershipId,
        number: nextAgreementNumber++,
        type,
        customerId: type === "buying" ? null : nextPerson(),
        sellerId: type === "hire_purchase" ? null : nextPerson(),
        witnessId: nextPerson(),
        nextOfKinId: nextPerson(),
        carId: nextCar(),
        bankAccountId: pick(accounts).id,
        agreedPrice,
        deposit,
        balance: agreedPrice - deposit,
        remainingDepositPaymentMethod: pick(["Cash", "Bank Transfer"] as const),
        paybill: random() < 0.5 ? "247247" : null,
        physicalLogbook: random() < 0.6,
        transferLogbook: random() < 0.5,
        uponPayment: random() < 0.4,
        installmentFrequency: type === "hire_purchase" ? "monthly" : null,
        installmentDuration: type === "hire_purchase" ? duration : null,
        startingDate: type === "hire_purchase" ? startingDate : null,
        hasTracker: type === "hire_purchase" && random() < 0.5,
        trackerFee: null,
        trackerDuration: null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning()

    if (hasTradeIn) {
      await db.insert(agreementTradeIns).values({
        dealershipId,
        agreementId: agreement!.id,
        carId: nextCar(),
        kind: type === "cash_sale" ? "cash" : type,
        amount: roundTo(agreedPrice * 0.3, 5_000),
      })
    }
    if (type !== "hire_purchase") continue

    // Simulate a realistic history: mostly on time, some short (carried), a few missed or paid ahead.
    const schedule: InstallmentAmounts[] = buildSchedule({
      balance: agreement!.balance,
      frequency: "monthly",
      duration,
      startingDate,
    }).map((row) => ({ ...row, id: randomUUID(), paid: 0, carriedOver: 0, carriedForward: 0 }))
    const paymentRows: (typeof payments.$inferInsert)[] = []
    const allocationRows: (typeof paymentAllocations.$inferInsert)[] = []
    const reliability = random()

    for (const installment of schedule) {
      if (installment.dueDate > today) break
      const owed = installment.amount + installment.carriedOver - installment.carriedForward - installment.paid
      if (owed <= 0) continue
      const roll = random()
      if (roll > 0.55 + reliability * 0.4) continue // missed → overdue
      const owedFromHere = schedule
        .filter((i) => i.sequence >= installment.sequence)
        .reduce((sum, i) => sum + Math.max(0, i.amount + i.carriedOver - i.carriedForward - i.paid), 0)
      const amount =
        roll < 0.12 ? roundTo(owed * 0.6, 500) : roll < 0.18 ? Math.min(owed + roundTo(owed * 0.5, 500), owedFromHere) : owed
      if (amount <= 0) continue
      const paymentPlan = planPayment(schedule, installment.id, amount, true)
      const paymentId = randomUUID()
      for (const allocation of paymentPlan.allocations) {
        const target = schedule.find((i) => i.id === allocation.installmentId)!
        if (allocation.kind === "paid") target.paid += allocation.amount
        if (allocation.kind === "carry_out") target.carriedForward += allocation.amount
        if (allocation.kind === "carry_in") target.carriedOver += allocation.amount
        allocationRows.push({ ...allocation, paymentId })
      }
      const paidOn = format(new Date(`${installment.dueDate}T00:00:00`).getTime() + Math.floor(random() * 6 - 2) * 86_400_000, "yyyy-MM-dd")
      paymentRows.push({
        id: paymentId,
        agreementId: agreement!.id,
        installmentId: installment.id,
        amount,
        paidOn: paidOn > today ? today : paidOn,
        notes: pick([null, null, "M-Pesa", "Bank deposit", "Cash at office"]),
        receiptKey: SAMPLE_RECEIPT_KEY,
        receiptName: "sample-receipt.pdf",
        receiptMimeType: "application/pdf",
        createdAt: new Date(`${paidOn}T10:00:00`),
      })
    }

    await db.insert(installments).values(schedule.map((i) => ({ ...i, agreementId: agreement!.id })))
    if (paymentRows.length) {
      await db.insert(payments).values(paymentRows)
      await db.insert(paymentAllocations).values(allocationRows)
      paymentCount += paymentRows.length
    }
  }

  // Invoices: a mix of drafts and live proformas (live ones get their final invoice).
  for (let index = 0; index < mix.invoices; index++) {
    const agreedPrice = roundTo(900_000 + random() * 2_000_000, 5_000)
    const deposit = roundTo(agreedPrice * 0.3, 5_000)
    const values = {
      dealershipId,
      customerId: nextPerson(),
      carId: nextCar(),
      bankAccountId: pick(accounts).id,
      agreedPrice,
      deposit,
      balance: agreedPrice - deposit,
    }
    const live = index % 3 !== 0
    const [proforma] = await db.insert(proformaInvoices).values({ ...values, status: live ? "live" : "draft" }).returning()
    if (live) await db.insert(finalInvoices).values({ ...values, proformaInvoiceId: proforma!.id })
  }

  return { agreements: plan.length, payments: paymentCount }
}

const DEALERSHIPS = [
  {
    code: "SLK", name: "Sleek Trading Limited", city: "Nakuru", phone: "0712000100", email: "info@sleektrading.co.ke",
    customers: 140, cars: 80, mix: { hp: 14, cash: 8, buying: 4, invoices: 10 },
    accounts: [
      { title: "Sleek Trading Ltd — Collections", bankName: "Equity Bank", branchName: "Nakuru", accountNumber: "0180291234567" },
      { title: "Sleek Trading Ltd — Operations", bankName: "KCB Bank", branchName: "Kenyatta Avenue", accountNumber: "1234567890" },
    ],
  },
  {
    code: "NRB", name: "Sleek Motors Nairobi", city: "Nairobi", phone: "0712000200", email: "nairobi@sleektrading.co.ke",
    customers: 90, cars: 55, mix: { hp: 10, cash: 6, buying: 3, invoices: 7 },
    accounts: [{ title: "Sleek Motors Nairobi", bankName: "NCBA Bank", branchName: "Westlands", accountNumber: "7701234001" }],
  },
  {
    code: "MSA", name: "Coast Autos Mombasa", city: "Mombasa", phone: "0712000300", email: "mombasa@coastautos.co.ke",
    customers: 60, cars: 40, mix: { hp: 7, cash: 5, buying: 2, invoices: 5 },
    accounts: [{ title: "Coast Autos Ltd", bankName: "Co-operative Bank", branchName: "Nyali", accountNumber: "01129876543200" }],
  },
  {
    code: "ELD", name: "Rift Valley Cars Eldoret", city: "Eldoret", phone: "0712000400", email: "eldoret@riftcars.co.ke",
    customers: 45, cars: 30, mix: { hp: 5, cash: 3, buying: 2, invoices: 4 }, suspended: true,
    accounts: [{ title: "Rift Valley Cars", bankName: "Equity Bank", branchName: "Eldoret", accountNumber: "0450298765432" }],
  },
]

export async function runSeed() {
  const { db, close } = createDatabase()
  const existing = await db.$count(dealerships)
  if (existing > 0) {
    // Upgrade path: a database seeded before sign-in or billing existed gets the missing demo data without losing anything.
    const rows = await db.select({ id: dealerships.id, code: dealerships.code }).from(dealerships)
    const byCode = new Map(rows.map((row) => [row.code, row.id]))
    const added: string[] = []
    if ((await db.$count(users)) === 0) {
      added.push(`${await seedUsers(db, byCode)} demo sign-ins`)
      await seedBranding(db, byCode)
    }
    if ((await db.$count(billingPlans)) === 0) {
      const billing = await seedBilling(db, byCode)
      added.push(`${billing.plans} billing plans and ${billing.invoices} platform invoices`)
    }
    console.log(added.length ? `Added ${added.join(" and ")} to the existing data.` : `Database already has ${existing} dealerships, so there is nothing to seed. Use \`npm run db:reset\` to start fresh.`)
    await close()
    return
  }

  writeSampleReceipt()
  const totals = { customers: 0, cars: 0, agreements: 0, payments: 0 }
  const dealershipIds = new Map<string, string>()
  for (const [index, spec] of DEALERSHIPS.entries()) {
    const createdAt = addMonths(new Date(), -(12 - index * 2))
    const [dealership] = await db
      .insert(dealerships)
      .values({
        code: spec.code,
        name: spec.name,
        city: spec.city,
        phone: spec.phone,
        email: spec.email,
        status: spec.suspended ? "suspended" : "active",
        createdAt,
        updatedAt: createdAt,
      })
      .returning()
    const id = dealership!.id
    dealershipIds.set(spec.code, id)
    await db.transaction(async (tx) => {
      await tx.insert(customers).values(makeCustomers(id, spec.customers))
      await tx.insert(cars).values(makeCars(id, spec.cars))
      await tx.insert(bankAccounts).values(spec.accounts.map((account) => ({ ...account, dealershipId: id })))
    })
    const deals = await seedDeals(db, id, spec.mix)
    totals.customers += spec.customers
    totals.cars += spec.cars
    totals.agreements += deals.agreements
    totals.payments += deals.payments
  }

  // Keep identity sequences ahead of the explicit numbers used above.
  await db.execute(sql`select setval(pg_get_serial_sequence('agreements', 'number'), (select max(number) from agreements))`)

  const billing = await seedBilling(db, dealershipIds)
  const signIns = await seedUsers(db, dealershipIds)
  await seedBranding(db, dealershipIds)

  console.log(
    `Seeded ${DEALERSHIPS.length} dealerships, ${totals.customers} customers, ${totals.cars} cars, ${totals.agreements} agreements with ${totals.payments} payments, ${billing.plans} billing plans, ${billing.invoices} platform invoices and ${signIns} demo sign-ins.`,
  )
  await close()
}
