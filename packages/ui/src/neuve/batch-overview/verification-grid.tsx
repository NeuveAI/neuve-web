import {
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { CapturePlayer } from "@workspace/ui/neuve/batch-overview/capture-player"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import type { VerificationCard } from "@workspace/ui/neuve/types"

const STROKE = 1.75
const ICON = "size-[15px] shrink-0"
const TILE =
  "box-border flex min-h-28 flex-col gap-2.5 rounded-xl bg-surface p-4 text-ink no-underline transition-colors duration-120 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none"
const STATUS = "inline-flex items-center gap-1.5 text-xs whitespace-nowrap"

type CardOf<TKind extends VerificationCard["kind"]> = Extract<
  VerificationCard,
  { kind: TKind }
>

/** Missing evidence: why it matters and why it may be missing. */
export function MissingEvidenceTile({ card }: { card: CardOf<"missing"> }) {
  return (
    <div
      className={cn(
        TILE,
        "col-span-7 shadow-[0_0_0_1px_var(--nv-req-tint-2)] max-[900px]:col-span-12"
      )}
    >
      <span className={cn(STATUS, "text-req-fg")}>
        <CircleAlertIcon
          aria-hidden="true"
          className={ICON}
          strokeWidth={STROKE}
        />
        Missing
      </span>
      <span className="text-[17px] leading-[23px] font-semibold tracking-[-0.01em]">
        {card.title}
      </span>
      <p className="m-0 text-[13.5px] leading-[21px] text-ink-2">{card.body}</p>
      <div className="flex flex-col gap-1.5 rounded-lg bg-paper px-3 py-2.5">
        <span className="label-mono text-[10.5px]">{card.reasonLabel}</span>
        <span className="text-[13px] leading-[19px] text-ink-2">
          {card.reason}
        </span>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          asChild
          variant="ink"
          size="dock"
          className="h-9 rounded-lg px-3 text-[13px]"
        >
          <NeuveLink destination={{ to: "unit", unitId: card.unitId }}>
            Decide intent in unit
          </NeuveLink>
        </Button>
        <Button
          type="button"
          variant="raised"
          size="dock"
          className="h-9 rounded-lg px-3 text-[13px] font-normal"
        >
          Request a check
        </Button>
      </div>
    </div>
  )
}

/** Observed capture: a mini-player that shows what was actually exercised. */
export function CaptureTile({ card }: { card: CardOf<"capture"> }) {
  return (
    <div
      className={cn(
        TILE,
        "col-span-5 p-2.5 shadow-[0_0_0_1px_var(--nv-line)] max-[900px]:col-span-12"
      )}
    >
      <CapturePlayer
        steps={card.steps}
        outcome={card.outcome}
        duration={card.duration}
      />
      <div className="flex flex-col gap-1 px-1.5 pt-1 pb-1.5">
        <span className={cn(STATUS, "text-agt-fg")}>
          <EyeIcon aria-hidden="true" className={ICON} strokeWidth={STROKE} />
          {card.observedOn}
        </span>
        <span className="text-[14.5px] leading-5 font-semibold">
          {card.title}
        </span>
        <span className="text-[12.5px] leading-[18px] text-ink-muted">
          {card.note}
        </span>
      </div>
    </div>
  )
}

/** Test evidence: the asserting excerpt and why it does (or doesn't) count. */
export function TestEvidenceTile({ card }: { card: CardOf<"test"> }) {
  const solid = card.strength === "solid"
  return (
    <NeuveLink
      destination={{ to: "unit", unitId: card.unitId }}
      className={cn(
        TILE,
        "col-span-6 shadow-[0_0_0_1px_var(--nv-line)] hover:bg-raised hover:text-ink max-[900px]:col-span-12"
      )}
    >
      <span className={cn(STATUS, solid ? "text-agt-fg" : "text-sug-fg")}>
        {solid ? (
          <CircleCheckIcon
            aria-hidden="true"
            className={ICON}
            strokeWidth={STROKE}
          />
        ) : (
          <TriangleAlertIcon
            aria-hidden="true"
            className={ICON}
            strokeWidth={STROKE}
          />
        )}
        {solid ? "Solid" : "Shallow"} · {card.file}
      </span>
      <span className="text-[14.5px] leading-5 font-semibold">
        {card.title}
      </span>
      <span className="rounded-md bg-paper px-2.5 py-2 font-mono text-[11.5px] leading-[18px] whitespace-pre text-ink-2">
        {card.excerpt}
      </span>
      <span className="text-[12.5px] leading-[18px] text-ink-muted">
        {card.why}
      </span>
    </NeuveLink>
  )
}

/** Verification: every card gives the reviewer a reason to care. */
export function VerificationGrid({
  summary,
  cards,
}: {
  summary: string
  cards: Array<VerificationCard>
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-base font-semibold">Verification</h2>
        <span className="flex-auto" />
        <span className="font-mono text-xs text-ink-muted">{summary}</span>
      </div>
      <div className="grid grid-cols-12 gap-3">
        {cards.map((card) => {
          if (card.kind === "missing")
            return <MissingEvidenceTile key={card.id} card={card} />
          if (card.kind === "capture")
            return <CaptureTile key={card.id} card={card} />
          return <TestEvidenceTile key={card.id} card={card} />
        })}
      </div>
    </section>
  )
}
