import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toggleTheme } from "@workspace/ui/neuve/shared/theme"

/**
 * Light/dark switch. Holds no React state: the `.dark` class on <html> is the
 * single source of truth, so the icon and accessible name swap via `dark:`.
 */
export function ThemeToggle() {
  return (
    <Button type="button" variant="quiet" size="icon-nav" onClick={toggleTheme}>
      <MoonIcon aria-hidden="true" className="size-[15px] dark:hidden" />
      <SunIcon aria-hidden="true" className="hidden size-[15px] dark:block" />
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="hidden dark:sr-only dark:block">
        Switch to light theme
      </span>
    </Button>
  )
}
