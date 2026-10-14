const kes = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
})

const compactKes = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  notation: "compact",
  maximumFractionDigits: 1,
})

const dateFormat = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" })

export const formatKES = (value: number) => kes.format(value)
export const formatKESCompact = (value: number) => compactKes.format(value)
export const formatDate = (value: Date | string) => dateFormat.format(new Date(value))
export const formatNumber = (value: number) => value.toLocaleString("en-KE")

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")
}
