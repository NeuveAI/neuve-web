/* ─────────────────────────────────────────────────────────
 * NEUVE MOTION TOKENS
 *
 * Source: neuve-motion skill (neuve_effect motion-tokens.ts) and the motion
 * storyboard note on the approved review canvas. Every animated surface in
 * the UI package reads its values from here — no inline springs or
 * durations in JSX.
 *
 * Rules carried by these tokens:
 *   - springs first; tweens only where the storyboard names a curve
 *   - enter ≠ exit: decelerate in (220–300ms), accelerate out (≤200ms)
 *   - transform + opacity only, never blur or layout properties
 *   - reduced motion: opacity-only 150ms tween, or instant
 * ───────────────────────────────────────────────────────── */

export const SPRING = {
  /** Buttons, row press, micro hover. */
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  /** General UI, tabs, panels (default). */
  responsive: { type: "spring", stiffness: 300, damping: 25 },
  /** Larger movements, dismissals, page and sheet transitions. */
  gentle: { type: "spring", stiffness: 200, damping: 20 },
} as const

export const EASE = {
  standard: [0.2, 0, 0, 1],
  standardDecelerate: [0, 0, 0, 1],
  standardAccelerate: [0.3, 0, 1, 1],
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15],
  /** iOS 26 web ease-out, used by the CSS-only hint and arrow nudges. */
  iosOut: [0.33, 1, 0.68, 1],
} as const

/** Milliseconds. Interface Craft TIMING table for the review surfaces. */
export const TIMING = {
  surfaceTone: 120, // hover tone shift on rows, pins, buttons
  pressIn: 80, // press compress
  hint: 140, // L1 hover hint fade
  dimOthers: 160, // other margin pins dim to 35% while a card is open
  card: 220, // L2 context card enter (emphasized decelerate)
  cardExit: 160, // L2 context card exit (accelerate)
  scrim: 160, // L3 sheet scrim fade
  sheetExit: 200, // L3 sheet exit (accelerate)
  pulseDelay: 280, // L3 cited fragment pulse waits for the sheet to land
  pulse: 900, // L3 cited fragment pulse length
  dockRise: 240, // dock state enters
  dockExit: 120, // dock state leaves
  chevron: 200, // neighbor collapse chevron turn
  laneTone: 160, // lane bar dims the other lanes
  laneLift: 200, // active lane scaleY
  caption: 220, // lane caption enters
  capture: 12000, // capture mini-player timeline
  reduced: 150, // reduced-motion opacity tween
} as const

export const ms = (value: number) => value / 1000

/** Opacity-only fallback used whenever the user asks for reduced motion. */
export const REDUCED_TRANSITION = {
  type: "tween",
  duration: ms(TIMING.reduced),
  ease: "easeOut",
} as const

/** Tailwind-friendly CSS durations for CSS-only micro-interactions. */
export const CSS_TRANSITION = {
  tone: "transition-colors duration-120 ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none",
} as const
