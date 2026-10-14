import { describe, expect, it } from "vitest"

import { candidateCodes, pickCode } from "./dealership-code"

describe("dealership codes", () => {
  it("derives a valid code from the name", () => {
    expect(candidateCodes("Sleek Trading Limited")[0]).toBe("SLE")
    expect(candidateCodes("Coast Autos Mombasa")[0]).toBe("CAM")
    expect(candidateCodes("Nairobi Motors")[0]).toBe("NAI")
  })

  it("always produces 2–5 capital letters", () => {
    for (const name of ["77 Motors", "X", "Äuto Haus", "A B", "The Very Long Dealership Name Group Ltd"]) {
      for (const code of candidateCodes(name)) expect(code).toMatch(/^[A-Z]{2,5}$/)
    }
  })

  it("skips codes that are taken and never runs out", () => {
    expect(pickCode("Nairobi Motors", new Set(["NAI"]))).toBe("NAIR")
    const taken = new Set(candidateCodes("Nairobi Motors").slice(0, -1))
    expect(pickCode("Nairobi Motors", taken)).toMatch(/^[A-Z]{2,5}$/)
  })
})
