import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FileIcon,
  Link2Icon,
  ShieldIcon,
  TargetIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { useAtomValue } from "jotai"

import { cn } from "@workspace/ui/lib/utils"
import { AgentTag } from "@workspace/ui/neuve/agents/agent-avatar"
import { agentByIdAtom } from "@workspace/ui/neuve/agents/atoms"
import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import type { JudgmentUnit } from "@workspace/ui/neuve/types"

const ICON = "size-[15px] shrink-0"
const STROKE = 1.75
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_112px_150px_120px_112px_20px] items-center gap-5 px-5 max-[900px]:grid-cols-[minmax(0,1fr)_20px]"
const COL = "max-[900px]:hidden"
const STAT =
  "inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-2"

function UnitRow({ unit, first }: { unit: JudgmentUnit; first: boolean }) {
  const agents = useAtomValue(agentByIdAtom)
  const agent = unit.agentId ? agents[unit.agentId] : undefined
  const SignalIcon =
    unit.signal.icon === "conflict" ? TriangleAlertIcon : ShieldIcon
  return (
    <NeuveLink
      destination={{ to: "unit", unitId: unit.id }}
      role="row"
      className={cn(
        ROW_GRID,
        "group/row py-4 text-ink no-underline transition-colors duration-120 ease-[cubic-bezier(.2,0,0,1)] hover:bg-raised hover:text-ink motion-reduce:transition-none",
        !first && "border-t border-line-2"
      )}
    >
      <span role="cell" className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-2.5 text-[15.5px] font-semibold tracking-[-0.01em]">
          <LaneGlyph lane="human-required" />
          {unit.title}
          {agent && <AgentTag agent={agent} />}
        </span>
        <span
          className={cn(
            STAT,
            "pl-5",
            unit.signal.tone === "req" && "text-req-fg"
          )}
        >
          <SignalIcon
            aria-hidden="true"
            className="size-[13px]"
            strokeWidth={STROKE}
          />
          {unit.signal.text}
        </span>
      </span>
      <span role="cell" className={cn(STAT, COL)}>
        <FileIcon aria-hidden="true" className={ICON} strokeWidth={STROKE} />
        {unit.files} · {unit.hunks} hunks
      </span>
      <span role="cell" className={cn(STAT, COL)}>
        <Link2Icon aria-hidden="true" className={ICON} strokeWidth={STROKE} />
        {unit.markers} markers
        {unit.unapproved ? (
          <span className="font-mono text-[11px] text-ink-muted">
            {unit.unapproved} unapproved
          </span>
        ) : null}
      </span>
      <span
        role="cell"
        className={cn(
          STAT,
          COL,
          unit.evidence.tone === "gap" ? "text-req-fg" : "text-agt-fg"
        )}
      >
        {unit.evidence.tone === "gap" ? (
          <CircleAlertIcon
            aria-hidden="true"
            className={ICON}
            strokeWidth={STROKE}
          />
        ) : (
          <CircleCheckIcon
            aria-hidden="true"
            className={ICON}
            strokeWidth={STROKE}
          />
        )}
        {unit.evidence.text}
      </span>
      <span role="cell" className={cn(STAT, COL)}>
        <TargetIcon aria-hidden="true" className={ICON} strokeWidth={STROKE} />
        {unit.readers} readers
      </span>
      <ArrowRightIcon
        aria-hidden="true"
        strokeWidth={STROKE}
        className={cn(
          ICON,
          "text-faint transition-[transform,color] duration-140 ease-[cubic-bezier(.33,1,.68,1)] group-hover/row:translate-x-[3px] group-hover/row:text-ink motion-reduce:transition-none"
        )}
      />
    </NeuveLink>
  )
}

/** Human-required units of the batch, one row each, linking to the desk. */
export function JudgmentTable({ units }: { units: Array<JudgmentUnit> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 mb-1 text-[22px] font-semibold tracking-[-0.02em]">
        Needs your judgment
      </h2>
      <div
        role="table"
        aria-label="Units that need your decision"
        className="overflow-hidden rounded-[14px] bg-surface shadow-[0_0_0_1px_var(--nv-line)]"
      >
        <div
          role="row"
          className={cn(
            ROW_GRID,
            "border-b border-line-2 py-3 max-[900px]:hidden"
          )}
        >
          <span role="columnheader" className="label-mono">
            Unit
          </span>
          <span role="columnheader" className="label-mono">
            Scope
          </span>
          <span role="columnheader" className="label-mono">
            Context
          </span>
          <span role="columnheader" className="label-mono">
            Evidence
          </span>
          <span role="columnheader" className="label-mono">
            Blast radius
          </span>
          <span />
        </div>
        {units.map((unit, i) => (
          <UnitRow key={unit.id} unit={unit} first={i === 0} />
        ))}
      </div>
    </section>
  )
}
