import type { ReviewLane } from "@workspace/ui/neuve/types"

/**
 * Lane glyphs from the designs: filled diamond (human-required), half-filled
 * diamond (human-suggested), ring (agentic review), rounded square (static
 * automation). Shape carries the lane, so colour is never the only signal.
 */
export function LaneGlyph({
  lane,
  className,
}: {
  lane: ReviewLane
  className?: string
}) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={className}
    >
      {lane === "human-required" && (
        <path d="M5 .8 9.2 5 5 9.2 .8 5z" fill="var(--nv-req)" />
      )}
      {lane === "human-suggested" && (
        <>
          <path
            d="M5 .8 9.2 5 5 9.2 .8 5z"
            fill="none"
            stroke="var(--nv-sug)"
            strokeWidth="1.4"
          />
          <path d="M5 .8V9.2L.8 5z" fill="var(--nv-sug)" />
        </>
      )}
      {lane === "agentic-review" && (
        <circle
          cx="5"
          cy="5"
          r="3.9"
          fill="none"
          stroke="var(--nv-agt)"
          strokeWidth="1.6"
        />
      )}
      {lane === "static-automation" && (
        <rect
          x="1.2"
          y="1.2"
          width="7.6"
          height="7.6"
          rx="1.5"
          fill="none"
          stroke="var(--nv-sta)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}
