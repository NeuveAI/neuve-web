import { useSetAtom } from "jotai"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  InfoIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { openCitationAtom } from "@workspace/ui/neuve/review-desk/atoms"
import type {
  ReviewDeskData,
  ReviewLane,
  UnitAttribution,
} from "@workspace/ui/neuve/types"

const LANE_HEADING: Record<ReviewLane, { text: string; className: string }> = {
  "human-required": { text: "Human-required", className: "text-req-fg" },
  "human-suggested": {
    text: "Human-suggested · optional",
    className: "text-sug-fg",
  },
  "agentic-review": {
    text: "Agentic review · decided by the agent",
    className: "text-agt-fg",
  },
  "static-automation": {
    text: "Static automation · checked by tools",
    className: "text-ink-2",
  },
}

/**
 * Who decided a unit outside the human-required lane, and how: the agent's
 * outcome with its evidence, or the checks that passed (Lanes.dc.html).
 */
function Attribution({ attribution }: { attribution: UnitAttribution }) {
  const agentDecided = attribution.outcome !== "passed"
  return (
    <div className="flex flex-col gap-[18px] pt-1.5">
      {agentDecided && (
        <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--nv-line)]">
          <span
            aria-hidden="true"
            className={cn(
              "row-span-3 inline-flex size-8 items-center justify-center rounded-[9px]",
              attribution.outcome === "approved"
                ? "bg-agt-tint text-agt-fg"
                : "bg-req-tint text-req-ink"
            )}
          >
            <EyeIcon className="size-[15px]" strokeWidth={1.75} />
          </span>
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {attribution.headline}
            <span className="font-mono text-[11px] font-normal text-ink-muted">
              {attribution.meta}
            </span>
          </span>
          {attribution.summary && (
            <span className="text-[13.5px] leading-5 text-ink-2">
              {attribution.summary}
            </span>
          )}
          {attribution.evidence && (
            <span className="flex flex-wrap gap-1.5 pt-1">
              {attribution.evidence.map((item) => (
                <span
                  key={item}
                  className="rounded-sm bg-agt-tint-2 px-[7px] py-0.5 font-mono text-[11px] text-agt-ink"
                >
                  {item}
                </span>
              ))}
            </span>
          )}
          {attribution.waiting && (
            <span className="flex items-center gap-2 pt-1 text-[12.5px] text-ink-muted">
              <span className="size-2 rounded-full bg-brand" />
              {attribution.waiting}
            </span>
          )}
        </div>
      )}
      {attribution.checks && (
        <ul className="m-0 flex list-none flex-col rounded-xl bg-surface p-0 shadow-[0_0_0_1px_var(--nv-line)]">
          {attribution.checks.map((check, i) => {
            const Icon =
              check.tone === "passed"
                ? CircleCheckIcon
                : check.tone === "blocking"
                  ? CircleAlertIcon
                  : InfoIcon
            return (
              <li
                key={check.title}
                className={cn(
                  "grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-[11px]",
                  i > 0 && "border-t border-line-2"
                )}
              >
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn(
                    "size-[15px]",
                    check.tone === "passed" && "text-agt",
                    check.tone === "blocking" && "text-req",
                    check.tone === "note" && "text-ink-muted"
                  )}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13.5px]">{check.title}</span>
                  {check.detail && (
                    <span className="font-mono text-[11px] text-ink-muted">
                      {check.detail}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    check.tone === "blocking" ? "text-req-fg" : "text-ink-muted"
                  )}
                >
                  {check.meta}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Unit heading + contextual briefing. Numbered citations open the cited
 * contextual marker's card in the margin (L2) — the briefing never carries the
 * source text itself.
 */
export function Briefing({ unit }: { unit: ReviewDeskData["unit"] }) {
  const openCitation = useSetAtom(openCitationAtom)

  return (
    <div className="flex max-w-[1060px] flex-col gap-3 px-8 pt-7 pb-5">
      <div className="flex items-center gap-2">
        <LaneGlyph lane={unit.lane} />
        <span className={cn("label-mono", LANE_HEADING[unit.lane].className)}>
          {LANE_HEADING[unit.lane].text}
          {unit.lane === "human-required" &&
            ` · ${unit.position.index} of ${unit.position.of}`}
        </span>
      </div>
      <h1 className="m-0 text-[28px] leading-[34px] font-semibold tracking-[-0.025em]">
        {unit.title}
      </h1>
      {unit.briefing.length > 0 && (
        <p className="m-0 max-w-[660px] text-[15px] leading-6 text-ink-2">
          {unit.briefing.map((segment, i) =>
            segment.kind === "text" ? (
              <span key={i}>{segment.text}</span>
            ) : (
              <button
                key={i}
                type="button"
                aria-label={segment.ariaLabel}
                onClick={() => openCitation(segment.markerKey)}
                className="rounded-[4px] border-0 bg-sug-tint px-[5px] align-[1px] font-mono text-[11px] leading-[18px] text-sug-ink transition-colors duration-120 hover:bg-sug-tint-2 motion-reduce:transition-none"
              >
                {segment.label}
              </button>
            )
          )}
        </p>
      )}
      {unit.attribution && <Attribution attribution={unit.attribution} />}
    </div>
  )
}
