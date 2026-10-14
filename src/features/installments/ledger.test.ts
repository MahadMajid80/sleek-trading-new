import { describe, expect, it } from "vitest"

import { buildSchedule, installmentStatus, planPayment, remainingAmount, type InstallmentAmounts } from "./ledger"

function makeSchedule() {
  return buildSchedule({ balance: 100000, frequency: "monthly", duration: 3, startingDate: "2026-01-31" }).map(
    (i, n): InstallmentAmounts => ({ ...i, id: `i${n + 1}`, paid: 0, carriedOver: 0, carriedForward: 0 }),
  )
}

function apply(schedule: InstallmentAmounts[], plan: ReturnType<typeof planPayment>) {
  for (const a of plan.allocations) {
    const i = schedule.find((x) => x.id === a.installmentId)!
    if (a.kind === "paid") i.paid += a.amount
    if (a.kind === "carry_out") i.carriedForward += a.amount
    if (a.kind === "carry_in") i.carriedOver += a.amount
  }
}

const owed = (schedule: InstallmentAmounts[]) => schedule.reduce((sum, i) => sum + remainingAmount(i), 0)

describe("buildSchedule", () => {
  it("splits the balance into whole shillings that sum exactly to the balance", () => {
    expect(makeSchedule().map((i) => i.amount)).toEqual([33333, 33333, 33334])
    const tiny = buildSchedule({ balance: 5, frequency: "monthly", duration: 4, startingDate: "2026-01-01" })
    expect(tiny.reduce((sum, i) => sum + i.amount, 0)).toBe(5)
    expect(tiny.every((i) => i.amount >= 0)).toBe(true)
  })

  it("clamps month-end due dates instead of overflowing into the next month", () => {
    expect(makeSchedule().map((i) => i.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"])
  })

  it("treats yearly durations as years of monthly payments", () => {
    expect(buildSchedule({ balance: 120000, frequency: "yearly", duration: 1, startingDate: "2026-01-01" })).toHaveLength(12)
  })
})

describe("planPayment", () => {
  it("carries an underpayment to the next installment without double counting it", () => {
    const schedule = makeSchedule()
    const plan = planPayment(schedule, "i1", 30000, true)
    apply(schedule, plan)
    expect(plan.carried).toBe(3333)
    expect(remainingAmount(schedule[0]!)).toBe(0)
    expect(remainingAmount(schedule[1]!)).toBe(36666)
    expect(installmentStatus(schedule[0]!, "2026-01-01")).toBe("carried")
    expect(owed(schedule)).toBe(70000)
  })

  it("uses an overpayment to pay the following installments", () => {
    const schedule = makeSchedule()
    const plan = planPayment(schedule, "i1", 40000, true)
    apply(schedule, plan)
    expect(plan.paidAhead).toBe(6667)
    expect(remainingAmount(schedule[1]!)).toBe(26666)
    expect(owed(schedule)).toBe(60000)
  })

  it("rejects payments larger than what is still owed", () => {
    expect(() => planPayment(makeSchedule(), "i3", 33335, true)).toThrow()
  })

  it("leaves a shortfall owing when carrying is off or there is no next installment", () => {
    const schedule = makeSchedule()
    apply(schedule, planPayment(schedule, "i1", 10000, false))
    expect(remainingAmount(schedule[0]!)).toBe(23333)
    expect(installmentStatus(schedule[0]!, "2026-01-15")).toBe("partial")
    expect(installmentStatus(schedule[0]!, "2026-02-01")).toBe("overdue")

    const plan = planPayment(schedule, "i3", 1000, true)
    expect(plan.leftOwing).toBe(32334)
  })
})
