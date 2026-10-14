// A dealership's short code prefixes its agreement numbers (e.g. NRB-1012). Admins no longer type it: it's derived from the
// name when the dealership is created and then never changes, so existing agreement numbers stay valid.

const FILLER = new Set(["THE", "AND", "OF", "LIMITED", "LTD", "LLC", "INC", "CO", "COMPANY", "PLC"])

/** Possible codes in order of preference. All are 2–5 capital letters, matching the database constraint. */
export function candidateCodes(name: string): string[] {
  const all = name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  const words = all.filter((word) => !FILLER.has(word))
  const use = words.length ? words : all
  const letters = use.join("") || "XX"
  const first = use[0] ?? "XX"
  const initials = use.map((word) => word[0]).join("")

  const ordered: string[] = []
  const add = (code: string) => {
    if (code.length >= 2 && code.length <= 5 && /^[A-Z]+$/.test(code) && !ordered.includes(code)) ordered.push(code)
  }
  if (initials.length >= 3) add(initials.slice(0, 5))
  add(first.slice(0, 3))
  add(first.slice(0, 4))
  add(first.slice(0, 5))
  add(letters.slice(0, 3))
  add(letters.slice(0, 4))
  add(initials.slice(0, 5))

  // Last resort: a stem plus one more letter, which gives 26 more options per stem.
  const stem = (letters.padEnd(2, "X")).slice(0, 4)
  for (const extra of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") add(stem + extra)
  return ordered
}

export function pickCode(name: string, taken: ReadonlySet<string>) {
  const code = candidateCodes(name).find((candidate) => !taken.has(candidate))
  if (!code) throw new Error("Couldn't generate a unique dealership code")
  return code
}
