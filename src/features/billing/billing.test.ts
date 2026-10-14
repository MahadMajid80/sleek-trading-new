import { describe, expect, it } from "vitest"

import { formatMoney, monthlyAmount } from "./meta"
import { transactionStatus } from "./sync"

describe("billing helpers", () => {
  it("derives refund status from amounts", () => {
    expect(transactionStatus(1000, 0, "succeeded")).toBe("succeeded")
    expect(transactionStatus(1000, 400, "succeeded")).toBe("partially_refunded")
    expect(transactionStatus(1000, 1000, "succeeded")).toBe("refunded")
    // A failed charge never becomes "refunded".
    expect(transactionStatus(1000, 1000, "failed")).toBe("failed")
  })

  it("normalises yearly prices for MRR", () => {
    expect(monthlyAmount(12_000_00, "year")).toBe(1_000_00)
    expect(monthlyAmount(4_900_00, "month")).toBe(4_900_00)
  })

  it("formats minor units in the invoice currency", () => {
    expect(formatMoney(1_290_000, "kes").replace(/\s/g, " ")).toMatch(/12,900/)
    expect(formatMoney(4_999, "usd")).toMatch(/49\.99/)
  })
})
