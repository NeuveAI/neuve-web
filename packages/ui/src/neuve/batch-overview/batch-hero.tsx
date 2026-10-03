import type { ReactNode } from "react"
import {
  ArrowRightIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  InfoIcon,
  LayersIcon,
  TicketIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import type { BatchOverviewData } from "@workspace/ui/neuve/types"

const ICON = "size-[15px] shrink-0"
const ICON_STROKE = 1.75

function Meta({
  icon: Icon,
  children,
  mono = true,
}: {
  icon: LucideIcon
  children: ReactNode
  mono?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" className={ICON} strokeWidth={ICON_STROKE} />
      <span className={mono ? "font-mono text-[12.5px]" : undefined}>
        {children}
      </span>
    </span>
  )
}

/**
 * Hero: batch title, provenance, the isolated (advisory) briefing and the
 * single next action.
 */
export function BatchHero({ data }: { data: BatchOverviewData }) {
  return (
    <section className="flex max-w-[760px] flex-col gap-5">
      <h1 className="m-0 text-[40px] leading-[46px] font-semibold tracking-[-0.03em]">
        {data.title}
      </h1>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-muted">
        <Meta icon={TicketIcon}>{data.ticket}</Meta>
        <Meta icon={GitBranchIcon}>{data.branch}</Meta>
        <Meta icon={GitCommitHorizontalIcon}>{data.revision}</Meta>
        <Meta icon={LayersIcon} mono={false}>
          {data.unitCount} units
        </Meta>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <p className="m-0 text-[17px] leading-[27px] text-ink-2">
          {data.briefing}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <InfoIcon
            aria-hidden="true"
            className="size-[13px]"
            strokeWidth={ICON_STROKE}
          />
          Advisory briefing · no decision required
        </span>
      </div>
      <div className="pt-2">
        <NeuveLink
          destination={{ to: "unit", unitId: data.firstUnitId }}
          className="group/cta inline-flex h-11 items-center gap-2.5 rounded-[10px] bg-ink px-[18px] text-sm font-medium text-paper no-underline hover:text-paper"
        >
          Start review
          <span className="font-mono text-[11px] opacity-70">
            {data.needYou} need you
          </span>
          <ArrowRightIcon
            aria-hidden="true"
            className="size-[15px] transition-transform duration-140 ease-[cubic-bezier(.33,1,.68,1)] group-hover/cta:translate-x-[3px] motion-reduce:transition-none"
            strokeWidth={ICON_STROKE}
          />
        </NeuveLink>
      </div>
    </section>
  )
}
