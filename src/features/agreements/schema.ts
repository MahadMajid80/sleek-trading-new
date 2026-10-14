import { z } from "zod"

export const AGREEMENT_TYPES = ["cash_sale", "hire_purchase", "buying"] as const
export type AgreementType = (typeof AGREEMENT_TYPES)[number]

export const agreementTypeMeta: Record<AgreementType, { label: string; short: string; description: string }> = {
  cash_sale: { label: "Cash sale agreement", short: "Cash sale", description: "Customer buys a vehicle outright." },
  hire_purchase: {
    label: "Hire purchase agreement",
    short: "Hire purchase",
    description: "Customer pays a deposit, then monthly installments.",
  },
  buying: { label: "Buying agreement", short: "Buying", description: "The dealership buys a vehicle from a seller." },
}

export const typeBadgeClass: Record<AgreementType, string> = {
  cash_sale: "border-success/30 bg-success/10 text-success",
  hire_purchase: "border-primary/30 bg-primary/12 text-accent-foreground",
  buying: "border-chart-2/30 bg-chart-2/10 text-foreground",
}

export const PAYMENT_METHODS = ["Cash", "Bank Transfer"] as const

/** e.g. SLK-1004 — each dealership numbers agreements with its own code. */
export const formatAgreementNumber = (number: number, dealershipCode: string) => `${dealershipCode}-${number}`

const optionalId = z.union([z.literal(""), z.uuid()])

// Whole shillings typed as digits; "" means empty.
const money = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{0,12}$/, `${label} must be a whole number of shillings`)

const toNumber = (value: string) => (value === "" ? 0 : Number(value))

export const agreementSchema = z
  .object({
    type: z.enum(AGREEMENT_TYPES),
    customerId: optionalId,
    sellerId: optionalId,
    witnessId: optionalId,
    nextOfKinId: optionalId,
    carId: z.union([z.literal(""), z.uuid()]),
    bankAccountId: optionalId,
    agreedPrice: money("Agreed price"),
    deposit: money("Deposit"),
    remainingDepositPaymentMethod: z.union([z.literal(""), z.enum(PAYMENT_METHODS)]),
    paybill: z.string().trim().max(40),
    physicalLogbook: z.boolean(),
    transferLogbook: z.boolean(),
    uponPayment: z.boolean(),
    tradeIns: z.array(z.object({ carId: z.union([z.literal(""), z.uuid()]), amount: money("Trade-in amount") })).max(10),
    installmentFrequency: z.union([z.literal(""), z.enum(["monthly", "yearly"])]),
    installmentDuration: z.string().trim().regex(/^\d{0,3}$/, "Enter a whole number"),
    startingDate: z.union([z.literal(""), z.iso.date("Pick a valid date")]),
    hasTracker: z.boolean(),
    trackerFee: money("Tracker fee"),
    trackerDuration: z.string().trim().max(40),
    includeAdditionalNotes: z.boolean(),
  })
  .superRefine((a, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: path.split("."), message })
    const isHp = a.type === "hire_purchase"

    if (!a.carId) issue("carId", "Select the car")
    if (!a.bankAccountId) issue("bankAccountId", "Select the bank account")
    if (a.type !== "buying" && !a.customerId) issue("customerId", "Select the buyer")
    if (a.type !== "hire_purchase" && !a.sellerId) issue("sellerId", "Select the seller")
    if (!a.witnessId) issue("witnessId", "Select a witness")
    if (!a.nextOfKinId) issue("nextOfKinId", "Select the next of kin")

    // One person can't hold two roles on the same agreement.
    const roles = [
      ["customerId", "buyer"],
      ["sellerId", "seller"],
      ["witnessId", "witness"],
      ["nextOfKinId", "next of kin"],
    ] as const
    roles.forEach(([field, label], index) => {
      const value = a[field]
      if (!value) return
      const clash = roles.slice(0, index).find(([other]) => a[other] === value)
      if (clash) issue(field, `The ${label} can't also be the ${clash[1]}`)
    })

    const agreed = toNumber(a.agreedPrice)
    const deposit = toNumber(a.deposit)
    if (a.agreedPrice === "" || agreed <= 0) issue("agreedPrice", "Enter the agreed price")
    if (deposit > agreed) issue("deposit", "Deposit can't be more than the agreed price")
    if (isHp && agreed > 0 && deposit >= agreed) issue("deposit", "Deposit must be less than the price so there's a balance to pay")

    const seen = new Set<string>()
    a.tradeIns.forEach((tradeIn, index) => {
      if (!tradeIn.carId) issue(`tradeIns.${index}.carId`, "Select the trade-in car")
      else if (tradeIn.carId === a.carId) issue(`tradeIns.${index}.carId`, "The car being sold can't also be a trade-in")
      else if (seen.has(tradeIn.carId)) issue(`tradeIns.${index}.carId`, "This car is already listed")
      seen.add(tradeIn.carId)
      if (tradeIn.amount === "" || toNumber(tradeIn.amount) <= 0) issue(`tradeIns.${index}.amount`, "Enter the trade-in value")
    })
    if (isHp && a.tradeIns.length > 1) issue("tradeIns", "Hire purchase agreements allow one trade-in vehicle")

    if (isHp) {
      if (!a.installmentFrequency) issue("installmentFrequency", "Choose monthly or yearly")
      const duration = toNumber(a.installmentDuration)
      if (duration < 1) issue("installmentDuration", "Enter the duration")
      else if (duration > (a.installmentFrequency === "yearly" ? 10 : 120)) issue("installmentDuration", "That's longer than 10 years")
      if (!a.startingDate) issue("startingDate", "Pick the first installment date")
      if (a.hasTracker) {
        if (a.trackerFee === "" || toNumber(a.trackerFee) <= 0) issue("trackerFee", "Enter the tracker fee")
        if (!a.trackerDuration) issue("trackerDuration", "Enter how long the tracker fee covers")
      }
    }
  })

export type AgreementFormValues = z.input<typeof agreementSchema>
export type AgreementInput = z.output<typeof agreementSchema>

export const emptyAgreement = (type: AgreementType): AgreementFormValues => ({
  type,
  customerId: "",
  sellerId: "",
  witnessId: "",
  nextOfKinId: "",
  carId: "",
  bankAccountId: "",
  agreedPrice: "",
  deposit: "",
  remainingDepositPaymentMethod: "",
  paybill: "",
  physicalLogbook: false,
  transferLogbook: false,
  uponPayment: false,
  tradeIns: [],
  installmentFrequency: type === "hire_purchase" ? "monthly" : "",
  installmentDuration: "",
  startingDate: "",
  hasTracker: false,
  trackerFee: "",
  trackerDuration: "",
  includeAdditionalNotes: false,
})

export const balanceOf = (values: Pick<AgreementFormValues, "agreedPrice" | "deposit">) =>
  Math.max(0, toNumber(values.agreedPrice) - toNumber(values.deposit))
