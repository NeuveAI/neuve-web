/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Commit lineage (Cycle.dc.html "What changed")
 *
 *    0ms   view fades in (card 220ms, emphasized decelerate)
 *    0ms   row hover / open: tone shift (surfaceTone 120ms, CSS)
 *    0ms   row opens: chevron turns 0 → 180° (chevron 200ms, standard);
 *          the detail rises, y -4 → 0, opacity 0 → 1
 *          (detail 240ms, emphasized decelerate)
 *  close   the detail fades (cardExit 160ms, accelerate)
 *
 * Reduced motion: opacity-only 150ms; the chevron snaps.
 * ───────────────────────────────────────────────────────── */

import { Provider, atom, useAtomValue, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react"
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon } from "lucide-react"

import { EASE, REDUCED_TRANSITION, TIMING, ms } from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import { agentsHydration } from "@workspace/ui/neuve/agents/atoms"
import { AppHeader } from "@workspace/ui/neuve/shared/app-header"
import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import type { NeuveDestination } from "@workspace/ui/neuve/shared/nav-link"
import type {
  AgentRegistry,
  CommitLineage,
  LineageEntry,
} from "@workspace/ui/neuve/types"

const DETAIL = {
  offsetY: -4,
  enter: { duration: ms(TIMING.detail), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.cardExit), ease: EASE.emphasizedAccelerate },
} as const

/** The lineage row whose detail is open (one at a time). */
export const lineageOpenAtom = atom<string | null>("renewed")

const RESULT_TONE: Record<LineageEntry["before"][number]["tone"], string> = {
  approved: "bg-agt-tint-2 text-agt-fg",
  changes: "bg-req-tint text-req-ink",
  agent: "bg-raised-2 text-ink-2",
}

const RELATION_LABEL: Record<LineageEntry["relation"], string> = {
  renewed: "Renewed signal",
  corrected: "Corrected",
  regrouped: "Regrouped",
  carried: "Carried forward",
}

const LINEAGE_GRID =
  "grid grid-cols-[minmax(0,1fr)_148px_minmax(0,1fr)] items-center gap-4 max-[760px]:grid-cols-[minmax(0,1fr)]"

function RelationArrow({ entry }: { entry: LineageEntry }) {
  const renewed = entry.relation === "renewed"
  const carried = entry.relation === "carried"
  const stroke = renewed
    ? "var(--nv-req)"
    : carried
      ? "var(--nv-faint)"
      : "var(--nv-ink-2)"
  return (
    <span
      className={cn(
        "flex items-center justify-center gap-2 text-xs max-[760px]:justify-start",
        renewed && "font-semibold text-req-fg",
        carried && "text-ink-muted",
        !renewed && !carried && "text-ink-2"
      )}
    >
      <svg
        width="34"
        height="10"
        viewBox="0 0 34 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 5h30"
          stroke={stroke}
          strokeWidth="1.4"
          strokeDasharray={carried ? "3 3" : undefined}
        />
        <path d="M27 1.5 31 5l-4 3.5" stroke={stroke} strokeWidth="1.4" />
      </svg>
      {RELATION_LABEL[entry.relation]}
    </span>
  )
}

function RenewedDetail({
  renewed,
}: {
  renewed: NonNullable<LineageEntry["renewed"]>
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--nv-line)]">
          <div className="flex h-9 items-center gap-2 border-b border-line-2 px-3">
            <span className="font-mono text-xs">{renewed.approved.file}</span>
            <span className="flex-auto" />
            <span className="font-mono text-[10.5px] text-ink-muted">
              {renewed.approved.note}
            </span>
          </div>
          <div className="grid grid-cols-[40px_minmax(0,1fr)] bg-req-tint py-1 font-mono text-[12.5px] leading-6 whitespace-pre-wrap">
            <span className="pr-2.5 text-right text-faint">
              {renewed.approved.line}
            </span>
            <span className="wrap-anywhere">{renewed.approved.text}</span>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--nv-line)]">
          <div className="flex h-9 items-center gap-2 border-b border-line-2 px-3">
            <span className="font-mono text-xs">{renewed.changed.file}</span>
            <span className="flex-auto" />
            <span className="font-mono text-[10.5px] text-req-fg">
              {renewed.changed.note}
            </span>
          </div>
          <div className="grid grid-cols-[40px_16px_minmax(0,1fr)] bg-del-bg font-mono text-[12.5px] leading-6 whitespace-pre-wrap">
            <span className="pr-2.5 text-right text-faint">
              {renewed.changed.line}
            </span>
            <span className="text-del-fg">−</span>
            <span className="wrap-anywhere">{renewed.changed.removed}</span>
          </div>
          <div className="grid grid-cols-[40px_16px_minmax(0,1fr)] bg-add-bg font-mono text-[12.5px] leading-6 whitespace-pre-wrap">
            <span className="pr-2.5 text-right text-faint">
              {renewed.changed.line}
            </span>
            <span className="text-add-fg">+</span>
            <span className="wrap-anywhere">{renewed.changed.added}</span>
          </div>
        </div>
      </div>
      <p className="m-0 max-w-[680px] text-[13.5px] leading-[21px] text-ink-2">
        {renewed.why}
      </p>
      <span className="font-mono text-[11px] text-ink-muted">
        {renewed.evidence}
      </span>
    </div>
  )
}

function LineageRow({
  entry,
  reviewer,
}: {
  entry: LineageEntry
  reviewer: string
}) {
  const openId = useAtomValue(lineageOpenAtom)
  const setOpen = useSetAtom(lineageOpenAtom)
  const reduce = useReducedMotion()
  const open = openId === entry.id
  const carried = entry.relation === "carried"
  const detailId = `lineage-${entry.id}`
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen(open ? null : entry.id)}
        className={cn(
          "w-full rounded-xl border-0 px-4 py-3.5 text-left transition-colors duration-120 ease-[cubic-bezier(.2,0,0,1)] hover:bg-raised motion-reduce:transition-none",
          open ? "bg-raised" : "bg-transparent"
        )}
      >
        <span className={LINEAGE_GRID}>
          <span
            className={cn(
              "flex min-w-0 flex-col gap-1",
              carried && "opacity-70"
            )}
          >
            {entry.before.map((unit) => (
              <span
                key={unit.title}
                className="flex min-w-0 items-center gap-2"
              >
                <span className="truncate text-[13.5px] font-medium">
                  {unit.title}
                </span>
                <span
                  className={cn(
                    "flex-none rounded-sm px-1.5 py-px font-mono text-[10.5px]",
                    RESULT_TONE[unit.tone]
                  )}
                >
                  {unit.result}
                </span>
              </span>
            ))}
          </span>
          <RelationArrow entry={entry} />
          <span className="flex min-w-0 items-center gap-2.5">
            {entry.needsYou && (
              <LaneGlyph lane="human-required" className="shrink-0" />
            )}
            <span className="flex min-w-0 flex-auto flex-col gap-0.5">
              <span
                className={cn(
                  "truncate text-sm",
                  carried
                    ? "font-normal text-ink-muted"
                    : "font-semibold text-ink"
                )}
              >
                {entry.after}
              </span>
              <span className="text-xs text-ink-muted">{entry.afterNote}</span>
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                "size-[15px] shrink-0 text-faint transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none",
                open && "rotate-180"
              )}
            />
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            id={detailId}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: DETAIL.offsetY }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: reduce ? REDUCED_TRANSITION : DETAIL.exit,
            }}
            transition={reduce ? REDUCED_TRANSITION : DETAIL.enter}
            className="px-4 pt-1 pb-4"
          >
            {entry.renewed && <RenewedDetail renewed={entry.renewed} />}
            {!entry.renewed && (
              <div className="flex max-w-[680px] flex-col gap-2">
                {entry.quote && (
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-5 flex-none items-center justify-center rounded-[10px_10px_10px_3px] bg-raised-2 text-[9px] font-semibold text-ink-2"
                    >
                      {reviewer}
                    </span>
                    <span className="text-[13px] leading-5 text-ink-2">
                      {entry.quote}
                    </span>
                  </div>
                )}
                {entry.note && (
                  <span className="text-[13px] leading-5 text-ink-2">
                    {entry.note}
                  </span>
                )}
              </div>
            )}
            {entry.needsYou && entry.unitId && (
              <div className="pt-3">
                <NeuveLink
                  destination={{ to: "unit", unitId: entry.unitId }}
                  className="inline-flex h-[34px] items-center gap-2 rounded-lg bg-ink px-3 text-[13px] font-medium text-paper no-underline transition-colors duration-120 hover:bg-ink/90 hover:text-paper motion-reduce:transition-none"
                >
                  Open unit
                  <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                </NeuveLink>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export interface LineageScreenProps {
  lineage: CommitLineage
  agents: AgentRegistry
  /** Where "Back to <commit>" returns (the unit under review). */
  back: NeuveDestination
  /** Initials of the reviewer, on quoted comments. */
  reviewerInitials?: string
  initialOpen?: string | null
}

function Lineage({
  lineage,
  agents,
  back,
  reviewerInitials = "YO",
  initialOpen = "renewed",
}: LineageScreenProps) {
  useHydrateAtoms([...agentsHydration(agents), [lineageOpenAtom, initialOpen]])
  const reduce = useReducedMotion()
  return (
    <div className="min-h-svh bg-paper font-sans text-sm text-ink">
      <AppHeader
        repo={lineage.repo}
        branch={lineage.branch}
        commit={`${lineage.to} · cycle ${lineage.cycle}`}
      />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          reduce
            ? REDUCED_TRANSITION
            : { duration: ms(TIMING.card), ease: EASE.emphasizedDecelerate }
        }
        className="mx-auto box-border flex max-w-[1080px] flex-col gap-7 px-6 pt-8 pb-24"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-[1_1_420px] flex-col gap-2">
            <NeuveLink
              destination={back}
              className="inline-flex h-[30px] items-center gap-1.5 self-start rounded-lg py-0 pr-2.5 pl-1.5 text-[12.5px] text-ink-muted no-underline transition-colors duration-120 hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
              Back to {lineage.from}
            </NeuveLink>
            <h1 className="m-0 text-[30px] leading-9 font-semibold tracking-[-0.03em]">
              What {lineage.to} asks of you
            </h1>
          </div>
          <div className="flex items-center gap-3.5 text-[13px] text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <LaneGlyph lane="human-required" />
              {lineage.needYou} need you
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                <path
                  d="M1 4h16"
                  stroke="var(--nv-faint)"
                  strokeWidth="1.4"
                  strokeDasharray="3 3"
                />
              </svg>
              {lineage.carried} carried forward
            </span>
          </div>
        </div>
        <section
          aria-label={`Units of ${lineage.from} and ${lineage.to}`}
          className="flex flex-col gap-1"
        >
          <div className={cn(LINEAGE_GRID, "px-4 pb-1.5")} aria-hidden="true">
            <span className="label-mono">{lineage.from} · your review</span>
            <span />
            <span className="label-mono">{lineage.to}</span>
          </div>
          {lineage.entries.map((entry) => (
            <LineageRow
              key={entry.id}
              entry={entry}
              reviewer={reviewerInitials}
            />
          ))}
        </section>
      </motion.main>
    </div>
  )
}

/**
 * Commit lineage: how the units you reviewed on one commit relate to the
 * next — renewed signals, corrections that answer your comments, regrouped
 * hunks (earlier approvals stay with the hunks they covered), and units
 * carried forward with no decision needed.
 */
export function LineageScreen(props: LineageScreenProps) {
  return (
    <Provider>
      <MotionConfig reducedMotion="user">
        <Lineage {...props} />
      </MotionConfig>
    </Provider>
  )
}
