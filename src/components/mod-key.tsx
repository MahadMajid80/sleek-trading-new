"use client"

import { useSyncExternalStore } from "react"

const noop = () => () => {}
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** "⌘" on Apple devices, "Ctrl" elsewhere. Renders "⌘" on the server, then corrects after hydration. */
export function useModKey() {
  return useSyncExternalStore(noop, () => (isMac() ? "⌘" : "Ctrl"), () => "⌘")
}

export function ModKey() {
  return <>{useModKey()}</>
}
