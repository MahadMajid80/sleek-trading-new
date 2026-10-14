import type { AgreementDetailData } from "@/features/agreements/queries"

// Maps new records onto the field names the ported legacy PDF generators read (see ./legacy).

type Person = { name: string; nationalId: string; kraPin: string; telephone: string; poBox: string | null; email: string | null }
type CarLike = {
  brand: string
  name: string
  bodyType: string
  year: number
  chassisNo: string | null
  engineNo: string | null
  regNo: string | null
  color: string
  cc: number
}
type AccountLike = { title: string; bankName: string; branchName: string | null; accountNumber: string }

export const legacyPerson = (person: Person | null) =>
  person && {
    name: person.name,
    id: person.nationalId,
    kraNo: person.kraPin,
    telephone: person.telephone,
    poBox: person.poBox ?? "",
    email: person.email ?? "",
  }

export const legacyCar = (car: CarLike) => ({
  brandName: car.brand,
  carName: car.name,
  makeLabel: `${car.brand} ${car.name}`,
  makeName: `${car.brand} ${car.name}`,
  label: `${car.brand} ${car.name}`,
  make: car.brand,
  model: String(car.year),
  type: car.bodyType,
  chesisNo: car.chassisNo ?? "",
  engNo: car.engineNo ?? "",
  regNo: car.regNo ?? "",
  color: car.color,
  cc: String(car.cc),
})

export const legacyAccount = (account: AccountLike | null) =>
  account && {
    accountTitle: account.title,
    bankName: account.bankName,
    branchName: account.branchName ?? "",
    accountNumber: account.accountNumber,
  }

const legacyTypeName = {
  cash_sale: "Cash Sale Agreement",
  hire_purchase: "HP Agreement",
  buying: "Buying Agreement",
} as const

export function legacyAgreement(a: AgreementDetailData) {
  const tradeIns = a.tradeIns.map((t) => ({ ...legacyCar(t.car), amount: t.amount }))
  const hasTradeIns = tradeIns.length > 0 ? "yes" : "no"
  const slkId = `${a.dealership.code.toLowerCase()}-${a.number}`
  return {
    id: slkId,
    slkId,
    type: legacyTypeName[a.type],
    createdAt: a.createdAt,
    user: legacyPerson(a.buyer),
    seller: legacyPerson(a.seller),
    witness: legacyPerson(a.witness),
    nextOfKin: legacyPerson(a.nextOfKin),
    car: legacyCar(a.car),
    account: legacyAccount(a.bankAccount),
    accountId: a.bankAccountId,
    agreedPrice: a.agreedPrice,
    deposit: a.deposit,
    balance: a.balance,
    paybill: a.paybill ?? "",
    physicalLogbook: a.physicalLogbook,
    transferLogbook: a.transferLogbook,
    uponPayment: a.uponPayment,
    remainingDepositPaymentMethod: a.remainingDepositPaymentMethod,
    // Cash sale
    cashTradeIn: hasTradeIns,
    cashTradeInCars: tradeIns,
    cashTradeInCar: tradeIns[0] ?? null,
    cashTradeInCarAmount: tradeIns[0]?.amount ?? 0,
    // Buying
    buyingTradeIn: hasTradeIns,
    buyingTradeInCars: tradeIns,
    buyingTradeInCar: tradeIns[0] ?? null,
    buyingTradeInCarAmount: tradeIns[0]?.amount ?? 0,
    // Hire purchase
    hpTradeIn: hasTradeIns,
    hpTradeInCar: tradeIns[0] ?? null,
    hpTradeInCarAmount: tradeIns[0]?.amount ?? null,
    installmentType: a.installmentFrequency,
    installmentDuration: a.installmentDuration,
    startingDate: a.startingDate,
    tracker: a.hasTracker ? "add" : "no",
    trackerFee: a.trackerFee,
    trackerDuration: a.trackerDuration ?? "",
    includeAdditionalNotes: a.includeAdditionalNotes,
  }
}

export type InvoiceDocumentInput = {
  invoice: { agreedPrice: number; deposit: number; balance: number; bankAccountId: string | null }
  customer: Person
  car: CarLike
  bankAccount: AccountLike | null
}

export const legacyInvoice = ({ invoice, customer, car, bankAccount }: InvoiceDocumentInput) => ({
  user: legacyPerson(customer),
  car: legacyCar(car),
  account: legacyAccount(bankAccount),
  accountId: invoice.bankAccountId,
  agreedPrice: invoice.agreedPrice,
  deposit: invoice.deposit,
  balance: invoice.balance,
})
