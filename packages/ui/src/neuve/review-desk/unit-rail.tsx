/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Unit rail
 *
 *    0ms   row hover: tone shift (surfaceTone 120ms, CSS)
 *    0ms   collapse / expand (button or "["): the column swaps between
 *          272px and the 60px icon column; the new content fades in
 *          (swap 180ms, standard)
 *    0ms   a shared marker is pointed at or opened: linked units tone-shift
 *          to the suggested tint (linked 160ms, standard); a unit shows a
 *          link glyph, a lane group one dot per linked unit (fade 160ms)
 *  leave   tones return (linked 160ms)
 *    0ms   a lane group expands: chevron turns (chevron 200ms); its units
 *          rise y -4 → 0, opacity 0 → 1 (detail 240ms, emphasized
 *          decelerate); collapse fades them (reduced 150ms)
 *
 * Reduced motion: the swap and link marks appear without fading; tone
 * shifts are instant.
 * ───────────────────────────────────────────────────────── */

import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  LinkIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { REDUCED_TRANSITION, TIMING, ms, EASE } from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import { AgentTag } from "@workspace/ui/neuve/agents/agent-avatar"
import { agentByIdAtom } from "@workspace/ui/neuve/agents/atoms"
import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import {
  dockAtom,
  hoverHintAtom,
  isDecidedAtom,
  openLanesAtom,
  openMarkerAtom,
  railCollapsedAtom,
  toggleLaneAtom,
  toggleRailAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import type {
  ContextualMarker,
  ElsewhereLane,
  ReviewDeskData,
  ReviewLane,
} from "@workspace/ui/neuve/types"

const RAIL = {
  swap: { duration: ms(TIMING.swap), ease: EASE.standard },
  lane: { duration: ms(TIMING.detail), ease: EASE.emphasizedDecelerate },
} as const

const TONE_ROW =
  "rounded-lg border-0 text-left no-underline transition-colors duration-160 ease-[cubic-bezier(.2,0,0,1)] hover:bg-raised motion-reduce:transition-none"

/** Rail chip for the current unit: its decision signal, then its disposition. */
function useRailChip(lane: ReviewLane) {
  const dock = useAtomValue(dockAtom)
  if (dock === "approved")
    return { text: "approved", className: "bg-raised-2 text-agt-fg" }
  if (dock === "agreed")
    return { text: "agreed", className: "bg-raised-2 text-agt-fg" }
  if (dock === "changes-requested")
    return { text: "changes requested", className: "bg-raised-2 text-ink-2" }
  if (dock === "commented")
    return { text: "commented", className: "bg-raised-2 text-ink-2" }
  if (lane !== "human-required") return null
  return { text: "conflict", className: "bg-req-tint text-req-ink" }
}

/**
 * The units that share the marker being pointed at or opened. One visual
 * language with the pin's dots: shared context is shown, never footnoted.
 */
function useLinkedUnits(markers: Record<string, ContextualMarker>) {
  const open = useAtomValue(openMarkerAtom)
  const hint = useAtomValue(hoverHintAtom)
  const active = open ?? hint?.markerKey ?? null
  return new Set(active ? (markers[active]?.sharedWith ?? []) : [])
}

function LinkMark({ label }: { label: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      role="img"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: ms(TIMING.linked), ease: "easeOut" }
      }
      className="inline-flex shrink-0 items-center gap-[3px] text-sug-fg"
    >
      <LinkIcon aria-hidden="true" className="size-3" strokeWidth={2} />
    </motion.span>
  )
}

function LinkDots({ count, label }: { count: number; label: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      role="img"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: ms(TIMING.linked), ease: "easeOut" }
      }
      className="inline-flex items-center gap-[3px]"
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="size-[5px] rounded-full bg-sug" />
      ))}
    </motion.span>
  )
}

/** Human gate meter: one segment per human-required unit. */
function GateMeter({ total }: { total: number }) {
  const decided = useAtomValue(isDecidedAtom)
  const settled = decided ? 1 : 0
  return (
    <>
      <span className="ml-auto inline-flex gap-0.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-3 rounded-[2px] transition-colors duration-200 motion-reduce:transition-none",
              i < settled ? "bg-req" : "bg-req-tint-2"
            )}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] text-ink-muted">
        <span className="sr-only">Decided </span>
        {settled}/{total}
      </span>
    </>
  )
}

function laneTitle(lane: ReviewLane) {
  return lane === "human-required"
    ? "needs your decision"
    : lane === "human-suggested"
      ? "suggested"
      : lane === "agentic-review"
        ? "agentic review"
        : "static automation"
}

function ExpandedRail({
  data,
  markers,
}: {
  data: ReviewDeskData
  markers: Record<string, ContextualMarker>
}) {
  const chip = useRailChip(data.unit.lane)
  const linked = useLinkedUnits(markers)
  const agents = useAtomValue(agentByIdAtom)
  const toggle = useSetAtom(toggleRailAtom)
  const laneOf = new Map(data.batchUnits.map((unit) => [unit.id, unit.lane]))

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Collapse sidebar"
            aria-keyshortcuts="["
            onClick={toggle}
            className="absolute top-[22px] right-2.5 z-2 inline-flex size-[30px] items-center justify-center rounded-lg border-0 bg-transparent text-ink-muted transition-colors duration-120 hover:bg-raised hover:text-ink motion-reduce:transition-none"
          >
            <PanelLeftCloseIcon aria-hidden="true" className="size-[15px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Collapse sidebar · [</TooltipContent>
      </Tooltip>

      <NeuveLink
        destination={{ to: "overview" }}
        className="group/back grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-[10px] py-2.5 pr-10 pl-2.5 text-ink no-underline transition-colors duration-120 hover:bg-raised hover:text-ink motion-reduce:transition-none"
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

      <section
        className="flex flex-col gap-0.5"
        aria-label="Needs your decision"
      >
        <div className="flex items-center gap-2 px-2.5 pb-2">
          <LaneGlyph lane="human-required" />
          <span className="text-xs font-semibold text-req-fg">
            Needs your decision
          </span>
          <GateMeter total={data.humanRequiredTotal} />
        </div>
        {data.railUnits.map((unit) => {
          const current = unit.id === data.unit.id
          const isLinked = linked.has(unit.id)
          const agent = unit.agentId ? agents[unit.agentId] : undefined
          return (
            <NeuveLink
              key={unit.id}
              destination={{ to: "unit", unitId: unit.id }}
              aria-current={current ? "page" : undefined}
              data-linked={isLinked ? "" : undefined}
              className={cn(
                TONE_ROW,
                "flex flex-col gap-1 p-2.5 text-ink hover:text-ink",
                current
                  ? "bg-select hover:bg-select"
                  : isLinked
                    ? "bg-sug-tint hover:bg-sug-tint"
                    : "bg-transparent"
              )}
            >
              <span className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex-auto text-[13.5px] text-ink",
                    current ? "font-semibold" : "font-medium"
                  )}
                >
                  {unit.title}
                </span>
                {isLinked && <LinkMark label="Shares the open context" />}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink-muted">
                  {unit.hunkCount} hunks
                </span>
                {current && chip && (
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-px font-mono text-[10.5px]",
                      chip.className
                    )}
                  >
                    {chip.text}
                  </span>
                )}
                {agent && <AgentTag agent={agent} className="ml-auto" />}
              </span>
            </NeuveLink>
          )
        })}
      </section>

      <section
        className="flex flex-col gap-0.5"
        aria-label="Decided by agents and tools"
      >
        <span className="px-2.5 pb-1.5 label-mono">
          Decided by agents and tools
        </span>
        {data.elsewhere.map((lane) => (
          <LaneGroup
            key={lane.lane}
            lane={lane}
            current={data.unit.id}
            linked={linked}
            linkedCount={
              [...linked].filter((id) => laneOf.get(id) === lane.lane).length
            }
          />
        ))}
      </section>
    </>
  )
}

/**
 * A lane decided by agents and tools: the group row expands in place to
 * list its units with their result (Lanes.dc.html); a unit navigates to its
 * desk. Shared-marker links tone-shift the group (and the linked unit).
 */
function LaneGroup({
  lane,
  current,
  linked,
  linkedCount,
}: {
  lane: ElsewhereLane
  current: string
  linked: ReadonlySet<string>
  linkedCount: number
}) {
  const openLanes = useAtomValue(openLanesAtom)
  const toggleLane = useSetAtom(toggleLaneAtom)
  const reduce = useReducedMotion()
  const open = openLanes.includes(lane.lane)
  const listId = `lane-${lane.lane}`
  const units = lane.units ?? []
  return (
    <div className="flex flex-col gap-px">
      <button
        type="button"
        aria-expanded={units.length > 0 ? open : undefined}
        aria-controls={units.length > 0 ? listId : undefined}
        onClick={() => units.length > 0 && toggleLane(lane.lane)}
        data-linked={linkedCount > 0 ? "" : undefined}
        className={cn(
          TONE_ROW,
          "grid grid-cols-[14px_minmax(0,1fr)_auto_14px] items-center gap-x-2.5 px-2.5 py-[9px]",
          lane.note ? "gap-y-0.5" : "gap-y-2.5",
          linkedCount > 0 ? "bg-sug-tint hover:bg-sug-tint" : "bg-transparent"
        )}
      >
        <LaneGlyph lane={lane.lane} />
        <span className="text-[13px]">{lane.label}</span>
        <span className="inline-flex items-center gap-1.5">
          {linkedCount > 0 && (
            <LinkDots
              count={linkedCount}
              label={`${linkedCount} ${lane.label.toLowerCase()} unit${linkedCount > 1 ? "s" : ""} share the open context`}
            />
          )}
          <span className="font-mono text-[11px] text-ink-muted">
            {lane.count}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-[13px] text-faint transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none",
            open && "rotate-180",
            units.length === 0 && "invisible"
          )}
        />
        {lane.note && (
          <>
            <span />
            <span className="col-span-3 text-[11.5px] text-ink-muted">
              {lane.note}
            </span>
          </>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="units"
            id={listId}
            role="list"
            aria-label={`${lane.label} units`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: REDUCED_TRANSITION }}
            transition={reduce ? REDUCED_TRANSITION : RAIL.lane}
            className="flex flex-col gap-px"
          >
            {units.map((unit) => {
              const here = unit.id === current
              const isLinked = linked.has(unit.id)
              return (
                <NeuveLink
                  key={unit.id}
                  role="listitem"
                  destination={{ to: "unit", unitId: unit.id }}
                  aria-current={here ? "page" : undefined}
                  data-linked={isLinked ? "" : undefined}
                  className={cn(
                    TONE_ROW,
                    "flex items-center justify-between gap-2 py-[7px] pr-2.5 pl-[34px] text-[13px] text-ink hover:text-ink",
                    here
                      ? "bg-select font-medium hover:bg-select"
                      : isLinked
                        ? "bg-sug-tint hover:bg-sug-tint"
                        : "bg-transparent"
                  )}
                >
                  <span className="min-w-0 truncate">{unit.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {isLinked && <LinkMark label="Shares the open context" />}
                    <span
                      className={cn(
                        "font-mono text-[10.5px]",
                        unit.tone === "req" ? "text-req-fg" : "text-ink-muted"
                      )}
                    >
                      {unit.result}
                    </span>
                  </span>
                </NeuveLink>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const ICON_BUTTON =
  "relative inline-flex size-9 items-center justify-center rounded-[9px] border-0 text-ink-muted no-underline transition-colors duration-160 ease-[cubic-bezier(.2,0,0,1)] hover:bg-raised hover:text-ink motion-reduce:transition-none"

function IconTip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The 60px icon column: identical 36px buttons — expand, back, divider,
 * the units to decide as their lane glyph (selected = tone shift), divider,
 * the lane groups as glyph + a small count badge. No loose text; names are
 * tooltips.
 */
function CollapsedRail({
  data,
  markers,
}: {
  data: ReviewDeskData
  markers: Record<string, ContextualMarker>
}) {
  const toggle = useSetAtom(toggleRailAtom)
  const openLanes = useAtomValue(openLanesAtom)
  const toggleLane = useSetAtom(toggleLaneAtom)
  const linked = useLinkedUnits(markers)
  // A lane glyph expands the rail with that lane's units listed.
  const openLaneFromIcon = (lane: ElsewhereLane["lane"]) => {
    if (!openLanes.includes(lane)) toggleLane(lane)
    toggle()
  }
  const laneOf = new Map(data.batchUnits.map((unit) => [unit.id, unit.lane]))
  return (
    <div className="flex flex-col items-center gap-1">
      <IconTip label="Expand sidebar · [">
        <button
          type="button"
          aria-label="Expand sidebar"
          aria-keyshortcuts="["
          onClick={toggle}
          className={cn(ICON_BUTTON, "bg-transparent")}
        >
          <PanelLeftOpenIcon aria-hidden="true" className="size-4" />
        </button>
      </IconTip>
      <IconTip label="Batch overview">
        <NeuveLink
          destination={{ to: "overview" }}
          aria-label="Batch overview"
          className={cn(ICON_BUTTON, "bg-transparent")}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
        </NeuveLink>
      </IconTip>
      <span aria-hidden="true" className="my-1.5 h-px w-5 bg-line" />
      {data.railUnits.map((unit) => {
        const current = unit.id === data.unit.id
        const isLinked = linked.has(unit.id)
        const label = `${unit.title} · ${laneTitle("human-required")}`
        return (
          <IconTip key={unit.id} label={label}>
            <NeuveLink
              destination={{ to: "unit", unitId: unit.id }}
              aria-label={label}
              aria-current={current ? "page" : undefined}
              data-linked={isLinked ? "" : undefined}
              className={cn(
                ICON_BUTTON,
                current
                  ? "bg-select hover:bg-select"
                  : isLinked
                    ? "bg-sug-tint hover:bg-sug-tint"
                    : "bg-transparent"
              )}
            >
              <LaneGlyph
                lane="human-required"
                outline={!current}
                className="size-[11px]"
              />
            </NeuveLink>
          </IconTip>
        )
      })}
      <span aria-hidden="true" className="my-1.5 h-px w-5 bg-line" />
      {data.elsewhere.map((lane) => {
        const label = `${lane.label} · ${lane.count} units`
        const count = [...linked].filter(
          (id) => laneOf.get(id) === lane.lane
        ).length
        return (
          <IconTip key={lane.lane} label={label}>
            <button
              type="button"
              aria-label={label}
              onClick={() => openLaneFromIcon(lane.lane)}
              data-linked={count > 0 ? "" : undefined}
              className={cn(
                ICON_BUTTON,
                count > 0 ? "bg-sug-tint hover:bg-sug-tint" : "bg-transparent"
              )}
            >
              <LaneGlyph lane={lane.lane} className="size-[11px]" />
              <span
                aria-hidden="true"
                className="absolute -top-[3px] -right-[5px] box-border h-4 min-w-4 rounded-lg bg-raised-2 px-1 text-center font-mono text-[9.5px] leading-4 text-ink-2 shadow-[0_0_0_2px_var(--nv-bg)]"
              >
                {lane.count}
              </span>
            </button>
          </IconTip>
        )
      })}
    </div>
  )
}

/**
 * Left rail: back to the batch overview, the units that need a decision
 * (current one selected by tone, never by an edge bar) with the human-gate
 * meter, and the lanes decided by agents and tools. Collapses to a 60px icon
 * column, remembered per viewer.
 */
export function UnitRail({
  data,
  markers = data.markers,
}: {
  data: ReviewDeskData
  /** Every marker of the unit (retrieved + review comments). */
  markers?: Record<string, ContextualMarker>
}) {
  const collapsed = useAtomValue(railCollapsedAtom)
  const reduce = useReducedMotion()
  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Review units"
        data-collapsed={collapsed ? "" : undefined}
        className={cn(
          "relative box-border flex max-w-full flex-col gap-6 border-r border-line min-[861px]:overflow-y-auto",
          collapsed
            ? "flex-[0_0_60px] px-0 py-4"
            : "flex-[1_1_272px] pt-4 pr-3 pb-5 pl-4"
        )}
      >
        <motion.div
          key={collapsed ? "collapsed" : "expanded"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? REDUCED_TRANSITION : RAIL.swap}
          className="flex flex-col gap-6"
        >
          {collapsed ? (
            <CollapsedRail data={data} markers={markers} />
          ) : (
            <ExpandedRail data={data} markers={markers} />
          )}
        </motion.div>
      </nav>
    </TooltipProvider>
  )
}
