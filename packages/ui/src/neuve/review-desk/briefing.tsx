import { useSetAtom } from "jotai"

import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { openCitationAtom } from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskData } from "@workspace/ui/neuve/types"

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
        <span className="label-mono text-req-fg">
          Human-required · {unit.position.index} of {unit.position.of}
        </span>
      </div>
      <h1 className="m-0 text-[28px] leading-[34px] font-semibold tracking-[-0.025em]">
        {unit.title}
      </h1>
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
    </div>
  )
}
