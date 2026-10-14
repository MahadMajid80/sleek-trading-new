import type { CSSProperties } from "react"

// Turns a dealership's chosen colours into CSS variable overrides for <html>. Client-safe (no server imports).

export const DEFAULT_SIDEBAR_COLOR = "#0f2a4a"
export const DEFAULT_ACCENT_COLOR = "#c79a3d"

export const HEX = /^#[0-9a-fA-F]{6}$/

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Readable text colour (near-black or white) for a given background. */
export const readableOn = (hex: string) => (luminance(hex) > 0.4 ? "#0f1b2d" : "#ffffff")

type Branding = { sidebarColor: string | null; accentColor: string | null }

export function brandStyle(branding: Branding | null | undefined): CSSProperties | undefined {
  if (!branding) return undefined
  const vars: Record<string, string> = {}
  const { sidebarColor, accentColor } = branding
  if (sidebarColor && HEX.test(sidebarColor)) {
    const fg = readableOn(sidebarColor)
    vars["--sidebar"] = sidebarColor
    vars["--sidebar-foreground"] = fg
    vars["--sidebar-accent"] = `color-mix(in oklch, ${sidebarColor}, ${fg === "#ffffff" ? "white" : "black"} 14%)`
    vars["--sidebar-accent-foreground"] = fg
    vars["--sidebar-border"] = `color-mix(in oklch, ${fg} 14%, transparent)`
  }
  if (accentColor && HEX.test(accentColor)) {
    vars["--gold"] = accentColor
    vars["--gold-light"] = `color-mix(in oklch, ${accentColor}, white 38%)`
    vars["--gold-tint"] = `color-mix(in oklch, ${accentColor}, white 86%)`
    vars["--btn-fg"] = readableOn(accentColor)
    vars["--sidebar-primary"] = accentColor
    vars["--sidebar-primary-foreground"] = readableOn(accentColor)
  }
  return Object.keys(vars).length ? (vars as CSSProperties) : undefined
}
