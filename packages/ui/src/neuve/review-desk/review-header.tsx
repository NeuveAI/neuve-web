import { useAtomValue } from "jotai"
import { SearchIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { BrandMark } from "@workspace/ui/neuve/shared/brand-mark"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import { Segmented } from "@workspace/ui/neuve/shared/segmented"
import { ThemeToggle } from "@workspace/ui/neuve/shared/theme-toggle"
import { isDecidedAtom } from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskData } from "@workspace/ui/neuve/types"

/**
 * Review desk header: brand (back to the batch), branch + revision, the human
 * gate meter, Units/Files mode and the theme switch.
 */
export function ReviewHeader({ data }: { data: ReviewDeskData }) {
  const decided = useAtomValue(isDecidedAtom)
  const settled = decided ? 1 : 0
  const segments = Array.from(
    { length: data.humanRequiredTotal },
    (_, i) => i < settled
  )

  return (
    <header className="box-border flex min-h-14 flex-wrap items-center gap-4 border-b border-line px-5 py-2">
      <NeuveLink
        destination={{ to: "overview" }}
        aria-label="Neuve — back to the review batch"
        className="no-underline"
      >
        <BrandMark />
      </NeuveLink>
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <span>{data.repo}</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-ink">{data.branch}</span>
        <span className="rounded-md bg-raised px-2 py-0.5 font-mono text-[11.5px] text-ink-2">
          {data.revision} · cycle {data.cycle}
        </span>
      </div>
      <div className="flex-auto" />
      <div className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
        <span>Human gate</span>
        <span className="inline-flex gap-[3px]" aria-hidden="true">
          {segments.map((filled, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-[18px] rounded-[2px] transition-colors duration-200 motion-reduce:transition-none",
                filled ? "bg-req" : "bg-req-tint-2"
              )}
            />
          ))}
        </span>
        <span className="font-mono text-[11.5px]">
          {settled}/{data.humanRequiredTotal} required
        </span>
      </div>
      <Segmented label="Browse by" options={["Units", "Files"]} value="Units" />
      <Button
        type="button"
        variant="quiet"
        size="icon-nav"
        aria-label="Find in batch"
      >
        <SearchIcon aria-hidden="true" className="size-[15px]" />
      </Button>
      <ThemeToggle />
    </header>
  )
}
