"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function useToggleTheme() {
  const { resolvedTheme, setTheme } = useTheme()
  return () => setTheme(resolvedTheme === "dark" ? "light" : "dark")
}

// Both icons render and CSS picks one, so the server and client markup match before the theme is known.
const ThemeIcon = () => (
  <>
    <Sun className="dark:hidden" />
    <Moon className="hidden dark:block" />
  </>
)

export function ThemeToggle() {
  const toggle = useToggleTheme()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          <ThemeIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle theme</TooltipContent>
    </Tooltip>
  )
}

export function ThemeMenuButton() {
  const toggle = useToggleTheme()
  return (
    <SidebarMenuButton onClick={toggle} tooltip="Toggle theme">
      <ThemeIcon />
      <span className="dark:hidden">Dark mode</span>
      <span className="hidden dark:inline">Light mode</span>
    </SidebarMenuButton>
  )
}
