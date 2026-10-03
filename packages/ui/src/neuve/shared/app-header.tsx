import { SearchIcon } from "lucide-react"

import { AgentsControl } from "@workspace/ui/neuve/agents/agents-control"
import { BrandMark } from "@workspace/ui/neuve/shared/brand-mark"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import { ThemeToggle } from "@workspace/ui/neuve/shared/theme-toggle"

/**
 * The one header for every screen (option A bar): logo + logotype (back to
 * the batch), repo / branch, the commit chip, the Agents control, Find ⌘K
 * and the theme toggle. The human gate and Units/Files live in the unit
 * column, not here.
 */
export function AppHeader({
  repo,
  branch,
  commit,
}: {
  repo: string
  branch: string
  /** Commit chip text, e.g. "a3f9c2e" or "b71e5aa · cycle 3". */
  commit: string
}) {
  return (
    <header className="relative box-border flex min-h-14 flex-wrap items-center gap-4 border-b border-line px-5 py-2">
      <NeuveLink
        destination={{ to: "overview" }}
        aria-label="Neuve — back to the review batch"
        className="no-underline"
      >
        <BrandMark />
      </NeuveLink>
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
        <span>{repo}</span>
        <span aria-hidden="true">/</span>
        <span className="truncate font-medium text-ink">{branch}</span>
        <span className="rounded-md bg-raised px-2 py-0.5 font-mono text-[11.5px] whitespace-nowrap text-ink-2">
          {commit}
        </span>
      </div>
      <div className="flex-auto" />
      <AgentsControl />
      <button
        type="button"
        aria-keyshortcuts="Meta+K"
        className="inline-flex h-8 items-center gap-2 rounded-lg border-0 bg-raised pr-2 pl-2.5 text-[12.5px] text-ink-muted transition-colors duration-120 hover:bg-raised-2 hover:text-ink motion-reduce:transition-none"
      >
        <SearchIcon aria-hidden="true" className="size-3.5" />
        Find
        <kbd className="rounded-sm bg-raised-2 px-[5px] py-px font-mono text-[10.5px] text-ink-muted">
          ⌘K
        </kbd>
      </button>
      <ThemeToggle />
    </header>
  )
}
