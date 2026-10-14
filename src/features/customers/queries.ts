"use client"

import { createResource } from "@/lib/resource"

import type { CustomerFormValues, CustomerRow } from "./schema"

export const customersResource = createResource<CustomerRow, CustomerFormValues>("customers", "/api/customers")
