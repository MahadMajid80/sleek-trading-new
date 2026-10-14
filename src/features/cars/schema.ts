import { z } from "zod"

import type { Car } from "@/db/schema"
import type { Jsonify } from "@/lib/types"

const maxYear = new Date().getFullYear() + 1

const identifier = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .pipe(
      z.union([
        z.literal(""),
        z.string().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`),
      ]),
    )

export const carSchema = z
  .object({
    brand: z.string().trim().min(1, "Brand is required").min(2, "Brand must be at least 2 characters").max(30),
    name: z.string().trim().min(1, "Model is required").max(40),
    bodyType: z
      .string()
      .trim()
      .min(1, "Body type is required")
      .min(2, "Body type must be at least 2 characters")
      .max(20)
      .regex(/^[\p{L}\s-]+$/u, "Body type can only contain letters"),
    year: z
      .string()
      .trim()
      .min(1, "Year is required")
      .regex(/^\d{4}$/, "Enter a 4-digit year")
      .transform(Number)
      .refine((year) => year >= 1950 && year <= maxYear, `Year must be between 1950 and ${maxYear}`),
    chassisNo: identifier(5, 30, "Chassis No"),
    engineNo: identifier(6, 30, "Engine No"),
    regNo: identifier(7, 8, "Registration No"),
    color: z.string().trim().min(1, "Color is required").min(2, "Color must be at least 2 characters").max(30),
    cc: z.string().trim().min(1, "Engine size is required").regex(/^\d{2,5}$/, "CC must be 2–5 digits").transform(Number),
  })
  .superRefine((car, ctx) => {
    if (!car.chassisNo && !car.regNo) {
      for (const path of ["chassisNo", "regNo"]) {
        ctx.addIssue({ code: "custom", path: [path], message: "Enter a Chassis No or a Registration No" })
      }
    }
  })

export type CarFormValues = z.input<typeof carSchema>
export type CarInput = z.output<typeof carSchema>

export type CarRow = Jsonify<Car>

export const emptyCar: CarFormValues = {
  brand: "",
  name: "",
  bodyType: "",
  year: "",
  chassisNo: "",
  engineNo: "",
  regNo: "",
  color: "",
  cc: "",
}

export function toCarFormValues(car: CarRow): CarFormValues {
  return {
    brand: car.brand,
    name: car.name,
    bodyType: car.bodyType,
    year: String(car.year),
    chassisNo: car.chassisNo ?? "",
    engineNo: car.engineNo ?? "",
    regNo: car.regNo ?? "",
    color: car.color,
    cc: String(car.cc),
  }
}

export const carTitle = (car: Pick<CarRow, "brand" | "name" | "year">) => `${car.year} ${car.brand} ${car.name}`
