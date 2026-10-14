import { addMonths, format, parseISO } from "date-fns"

// Pure installment maths, shared by the API, the seed script and the payment dialog's live preview.

export type InstallmentAmounts = {
  id: string
  sequence: number
  dueDate: string
  amount: number
  paid: number
  carriedOver: number
  carriedForward: number
}

export type InstallmentStatus = "paid" | "carried" | "overdue" | "partial" | "pending"

export const round2 = (value: number) => Math.round(value * 100) / 100

export const amountDue = (i: Omit<InstallmentAmounts, "id" | "sequence" | "dueDate">) =>
  round2(i.amount + i.carriedOver - i.carriedForward)

export const remainingAmount = (i: Omit<InstallmentAmounts, "id" | "sequence" | "dueDate">) =>
  Math.max(0, round2(amountDue(i) - i.paid))

// Business day in Kenya regardless of server/browser timezone; matches todaySql in sql.ts.
export const todayISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  )

export function installmentStatus(i: Omit<InstallmentAmounts, "id" | "sequence">, today = todayISO()): InstallmentStatus {
  if (remainingAmount(i) === 0) return i.carriedForward > 0 && i.paid < i.amount + i.carriedOver ? "carried" : "paid"
  if (i.dueDate < today) return "overdue"
  if (i.paid > 0) return "partial"
  return "pending"
}

export const statusMeta: Record<InstallmentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success/12 text-success border-success/25" },
  carried: { label: "Carried forward", className: "bg-muted text-muted-foreground" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/25" },
  partial: { label: "Partly paid", className: "bg-warning/12 text-warning border-warning/30" },
  pending: { label: "Upcoming", className: "bg-secondary text-secondary-foreground" },
}

/**
 * Splits the HP balance into monthly installments. "yearly" means the duration is given in years; payments are
 * still monthly. Whole shillings; the last installment absorbs the rounding so the total always equals the balance.
 */
export function buildSchedule({
  balance,
  frequency,
  duration,
  startingDate,
}: {
  balance: number
  frequency: "monthly" | "yearly"
  duration: number
  startingDate: string
}) {
  const months = frequency === "yearly" ? duration * 12 : duration
  const base = Math.floor(balance / months)
  const start = parseISO(startingDate)
  return Array.from({ length: months }, (_, index) => ({
    sequence: index + 1,
    dueDate: format(addMonths(start, index), "yyyy-MM-dd"),
    amount: index === months - 1 ? round2(balance - base * (months - 1)) : base,
  }))
}

export type Allocation = { installmentId: string; kind: "paid" | "carry_out" | "carry_in"; amount: number }

export type PaymentPlan = {
  allocations: Allocation[]
  /** Paid towards the chosen installment. */
  toTarget: number
  /** Excess that paid off following installments. */
  paidAhead: number
  /** Unpaid remainder moved to the next installment. */
  carried: number
  /** Unpaid remainder left owing on the chosen installment. */
  leftOwing: number
}

export class PaymentPlanError extends Error {}

/**
 * Decides how a payment against `targetId` changes the schedule:
 * - up to the target's remaining amount pays the target;
 * - any excess pays the following installments in order (paying ahead);
 * - if it falls short and `carryShortfall` is set, the unpaid remainder moves to the next installment.
 */
export function planPayment(
  schedule: InstallmentAmounts[],
  targetId: string,
  amount: number,
  carryShortfall: boolean,
): PaymentPlan {
  const ordered = [...schedule].sort((a, b) => a.sequence - b.sequence)
  const targetIndex = ordered.findIndex((i) => i.id === targetId)
  const target = ordered[targetIndex]
  if (!target) throw new PaymentPlanError("Installment not found on this agreement")

  const value = round2(amount)
  if (value <= 0) throw new PaymentPlanError("Amount must be greater than zero")

  const targetRemaining = remainingAmount(target)
  if (targetRemaining === 0) throw new PaymentPlanError("This installment is already settled")

  const later = ordered.slice(targetIndex + 1)
  const payable = round2(targetRemaining + later.reduce((sum, i) => sum + remainingAmount(i), 0))
  if (value > payable) {
    throw new PaymentPlanError(`Amount is more than the KSh ${payable.toLocaleString("en-KE")} still owed from this installment onwards`)
  }

  const allocations: Allocation[] = []
  const toTarget = Math.min(value, targetRemaining)
  allocations.push({ installmentId: target.id, kind: "paid", amount: toTarget })

  let excess = round2(value - toTarget)
  let paidAhead = 0
  for (const next of later) {
    if (excess <= 0) break
    const take = Math.min(excess, remainingAmount(next))
    if (take > 0) {
      allocations.push({ installmentId: next.id, kind: "paid", amount: take })
      excess = round2(excess - take)
      paidAhead = round2(paidAhead + take)
    }
  }

  const shortfall = round2(targetRemaining - toTarget)
  const carryTo = later[0]
  let carried = 0
  if (shortfall > 0 && carryShortfall && carryTo) {
    allocations.push({ installmentId: target.id, kind: "carry_out", amount: shortfall })
    allocations.push({ installmentId: carryTo.id, kind: "carry_in", amount: shortfall })
    carried = shortfall
  }

  return { allocations, toTarget, paidAhead, carried, leftOwing: round2(shortfall - carried) }
}
