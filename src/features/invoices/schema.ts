import { z } from "zod"

export type InvoiceKind = "proforma" | "final"

export const invoiceKindMeta: Record<InvoiceKind, { title: string; singular: string; prefix: string; api: string }> = {
  proforma: { title: "Proforma invoices", singular: "Proforma invoice", prefix: "PRO", api: "/api/proforma-invoices" },
  final: { title: "Final invoices", singular: "Final invoice", prefix: "INV", api: "/api/final-invoices" },
}

export const formatInvoiceNumber = (kind: InvoiceKind, number: number) =>
  `${invoiceKindMeta[kind].prefix}-${String(number).padStart(4, "0")}`

const money = (label: string) => z.string().trim().regex(/^\d{0,12}$/, `${label} must be a whole number of shillings`)

export const invoiceSchema = z
  .object({
    customerId: z.union([z.literal(""), z.uuid()]),
    carId: z.union([z.literal(""), z.uuid()]),
    bankAccountId: z.union([z.literal(""), z.uuid()]),
    agreedPrice: money("Agreed price"),
    deposit: money("Deposit"),
    status: z.enum(["draft", "live"]),
  })
  .superRefine((invoice, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message })
    if (!invoice.customerId) issue("customerId", "Select the customer")
    if (!invoice.carId) issue("carId", "Select the car")
    if (!invoice.bankAccountId) issue("bankAccountId", "Select the bank account")
    const agreed = Number(invoice.agreedPrice || 0)
    if (agreed <= 0) issue("agreedPrice", "Enter the agreed price")
    if (Number(invoice.deposit || 0) > agreed) issue("deposit", "Deposit can't be more than the agreed price")
  })

export type InvoiceFormValues = z.input<typeof invoiceSchema>

export const emptyInvoice: InvoiceFormValues = {
  customerId: "",
  carId: "",
  bankAccountId: "",
  agreedPrice: "",
  deposit: "",
  status: "draft",
}
