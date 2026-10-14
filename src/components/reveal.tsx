import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Pure CSS entrance: content is visible in the server HTML and never waits on JavaScript to appear.
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 ease-out motion-reduce:animate-none",
        className,
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  )
}
