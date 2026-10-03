import { useAtomValue } from "jotai"
import { ArrowLeftIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import { dockAtom, isDecidedAtom } from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskData } from "@workspace/ui/neuve/types"

const TONE_ROW =
  "rounded-lg border-0 text-left transition-colors duration-120 ease-[cubic-bezier(.2,0,0,1)] hover:bg-raised motion-reduce:transition-none"

/** Rail chip for the current unit: its decision signal, then its disposition. */
function useRailChip() {
  const dock = useAtomValue(dockAtom)
  if (dock === "approved")
    return { text: "approved", className: "bg-raised-2 text-agt-fg" }
  if (dock === "changes-requested")
    return { text: "changes requested", className: "bg-raised-2 text-ink-2" }
  return { text: "conflict", className: "bg-req-tint text-req-ink" }
}

/**
 * Left rail: back to the batch overview, the units that need a decision
 * (current one selected by tone, never by an edge bar), and the other lanes.
 */
export function UnitRail({ data }: { data: ReviewDeskData }) {
  const decided = useAtomValue(isDecidedAtom)
  const chip = useRailChip()
  const remaining = data.railUnits.length - (decided ? 1 : 0)

  return (
    <nav
      aria-label="Review units"
      className="box-border flex max-w-full flex-[1_1_272px] flex-col gap-6 border-r border-line pt-4 pr-3 pb-5 pl-4 min-[861px]:overflow-y-auto"
    >
      <NeuveLink
        destination={{ to: "overview" }}
        className="group/back grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-[10px] p-2.5 text-ink no-underline transition-colors duration-120 hover:bg-raised hover:text-ink motion-reduce:transition-none"
      >
        <span className="row-span-2 inline-flex size-8 items-center justify-center rounded-lg bg-raised text-ink-2 group-hover/back:bg-raised-2 group-hover/back:text-ink">
          <ArrowLeftIcon
            aria-hidden="true"
            strokeWidth={1.9}
            className="size-4 transition-transform duration-140 ease-[cubic-bezier(.33,1,.68,1)] group-hover/back:-translate-x-[3px] motion-reduce:transition-none"
          />
        </span>
        <span className="text-xs text-ink-muted">Batch overview</span>
        <span className="text-sm leading-[19px] font-semibold tracking-[-0.01em]">
          {data.batchTitle}
        </span>
      </NeuveLink>

      <section className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 px-2.5 pb-2">
          <LaneGlyph lane="human-required" />
          <span className="text-xs font-semibold text-req-fg">
            Needs your decision
          </span>
          <span className="ml-auto font-mono text-[11px] text-ink-muted">
            {remaining}
          </span>
        </div>
        {data.railUnits.map((unit) => {
          const current = unit.id === data.unit.id
          return (
            <button
              key={unit.id}
              type="button"
              aria-current={current ? "true" : undefined}
              className={cn(
                TONE_ROW,
                "flex flex-col gap-1 p-2.5",
                current ? "bg-select hover:bg-select" : "bg-transparent"
              )}
            >
              <span
                className={cn(
                  "text-[13.5px] text-ink",
                  current ? "font-semibold" : "font-medium"
                )}
              >
                {unit.title}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink-muted">
                  {unit.hunkCount} hunks
                </span>
                {current && (
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-px font-mono text-[10.5px]",
                      chip.className
                    )}
                  >
                    {chip.text}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </section>

      <section className="flex flex-col gap-0.5">
        <span className="px-2.5 pb-1.5 label-mono">
          Elsewhere in this batch
        </span>
        {data.elsewhere.map((lane) => (
          <button
            key={lane.lane}
            type="button"
            className={cn(
              TONE_ROW,
              "grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-2.5 bg-transparent px-2.5 py-[9px]",
              lane.note ? "gap-y-0.5" : "gap-y-2.5"
            )}
          >
            <LaneGlyph lane={lane.lane} />
            <span className="text-[13px]">{lane.label}</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {lane.count}
            </span>
            {lane.note && (
              <>
                <span />
                <span className="col-span-2 text-[11.5px] text-ink-muted">
                  {lane.note}
                </span>
              </>
            )}
          </button>
        ))}
      </section>
    </nav>
  )
}
