import { describe, expect, it } from "vitest"

import { generateTemporaryPassword, hashPassword, verifyPassword } from "./password"

describe("passwords", () => {
  it("verifies the right password and rejects wrong ones", async () => {
    const hash = await hashPassword("correct horse battery")
    expect(hash.startsWith("scrypt$")).toBe(true)
    expect(await verifyPassword("correct horse battery", hash)).toBe(true)
    expect(await verifyPassword("correct horse batter", hash)).toBe(false)
    expect(await verifyPassword("", hash)).toBe(false)
  })

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"))
  })

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false)
  })

  it("generates readable temporary passwords", () => {
    const password = generateTemporaryPassword()
    expect(password).toHaveLength(12)
    expect(password).toMatch(/^[A-Za-z2-9]+$/)
    expect(password).not.toMatch(/[O0Il1]/)
  })
})
