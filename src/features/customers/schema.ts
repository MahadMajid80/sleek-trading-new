import { z } from "zod"

import type { Customer } from "@/db/schema"
import type { Jsonify } from "@/lib/types"

const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal(""), schema])

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name must be at most 50 characters")
    .regex(/^[\p{L}\s'.-]+$/u, "Name can only contain letters and spaces"),
  nationalId: z.string().trim().min(1, "National ID is required").regex(/^\d{1,8}$/, "National ID is up to 8 digits"),
  telephone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(/^\+?\d{9,14}$/, "Enter a valid phone number, e.g. 0712345678"),
  email: optional(z.email("Enter a valid email address").max(50, "Email must be at most 50 characters")),
  kraPin: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "KRA PIN is required")
    .regex(/^[A-Z]\d{9}[A-Z]$/, "KRA PIN has the format A012345678X"),
  poBox: optional(z.string().trim().min(5, "P.O. Box must be at least 5 characters").max(15)),
})

export type CustomerFormValues = z.input<typeof customerSchema>

export type CustomerRow = Jsonify<Customer>

export const emptyCustomer: CustomerFormValues = {
  name: "",
  nationalId: "",
  telephone: "",
  email: "",
  kraPin: "",
  poBox: "",
}

export function toCustomerFormValues(customer: CustomerRow): CustomerFormValues {
  return {
    name: customer.name,
    nationalId: customer.nationalId,
    telephone: customer.telephone,
    email: customer.email ?? "",
    kraPin: customer.kraPin,
    poBox: customer.poBox ?? "",
  }
}
