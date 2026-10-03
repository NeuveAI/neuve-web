/**
 * Neuve configuration for the @workspace/diffs fork (Pierre diffs).
 *
 * - One Shiki theme whose token colours are CSS variables. The variables are
 *   mapped to the brand syntax tokens in globals.css (`.nv-diff`), so light and
 *   dark follow the `.dark` class with no re-highlighting and no theme reads in
 *   components.
 * - Shared render options and virtual-layout metrics that match the approved
 *   row geometry (24px rows, 28px expand rows, no file header).
 * - A lazily created worker pool so Shiki highlighting runs off the main
 *   thread in the browser (never on the server).
 */
import { registerCustomCSSVariableTheme } from "@workspace/diffs"
import type { FileDiffOptions, VirtualFileMetrics } from "@workspace/diffs"
import { getOrCreateWorkerPoolSingleton } from "@workspace/diffs/worker"
import type { WorkerPoolManager } from "@workspace/diffs/worker"
// Vite bundles the worker entry as its own chunk (`?worker`).
import DiffsWorker from "@workspace/diffs/worker/worker.js?worker"

export const NEUVE_DIFF_THEME = "neuve"

/** Defaults only matter when a host lacks the `.nv-diff` class. */
const THEME_DEFAULTS: Record<string, string> = {
  foreground: "var(--nv-syn-pl)",
  background: "var(--nv-surface)",
  "token-keyword": "var(--nv-syn-kw)",
  "token-string": "var(--nv-syn-st)",
  "token-string-expression": "var(--nv-syn-st)",
  "token-function": "var(--nv-syn-fn)",
  "token-comment": "var(--nv-syn-cm)",
  "token-constant": "var(--nv-syn-nu)",
  "token-parameter": "var(--nv-syn-id)",
  "token-punctuation": "var(--nv-syn-pl)",
  "token-link": "var(--nv-syn-fn)",
}

let themeRegistered = false

export function ensureNeuveDiffTheme() {
  if (themeRegistered) return
  themeRegistered = true
  registerCustomCSSVariableTheme(NEUVE_DIFF_THEME, THEME_DEFAULTS, true)
}

/** Row geometry from the design; the virtual layout estimates with it. */
export const DIFF_METRICS: Partial<VirtualFileMetrics> = {
  lineHeight: 24,
  diffHeaderHeight: 0,
  hunkSeparatorHeight: 28,
  spacing: 0,
  paddingTop: 0,
  paddingBottom: 0,
}

/**
 * Styles injected into the diff's shadow root (Pierre's `unsafeCSS` layer).
 * Only geometry and typography that brand variables cannot reach.
 */
const SURFACE_CSS = `
:host { --diffs-gap-block: 0px; --diffs-overlay-width: 300px; }
/* Pierre mixes the diff colours into the row background (80–91%); the brand
   tokens are already the final colours, so use them unmixed. */
[data-line], [data-no-newline], [data-gutter-buffer], [data-column-number] {
  --mix-light: 0%;
  --mix-dark: 0%;
}
pre { border-radius: 0 0 10px 10px; overflow: hidden; }
[data-separator='line-info'] { height: 28px; min-height: 28px; font-size: 11.5px; }
[data-separator-content] { color: var(--nv-muted); }
[data-separator-content] [data-unmodified-lines]::before { content: 'Show '; }
[data-column-number] { font-size: 11.5px; }
/* Gutter as the comment surface: tone shift on hover/focus, a small "+"
   handle (the fork reveals it on focus too), pointer cursor. */
[data-interactive-line-numbers] [data-column-number] { cursor: pointer; }
/* Selected lines: the same accent tint a comment's lines get when open, over
   the row's own diff colour (the mix override above would otherwise erase
   Pierre's selection mix). */
:is([data-line], [data-column-number])[data-selected-line] {
  box-shadow: inset 0 0 0 100vmax var(--diffs-overlay-range-strong);
}
[data-utility-button] {
  width: 18px; height: 18px; margin-right: -6px; margin-top: 3px;
  border-radius: 5px;
  background-color: var(--nv-ink); color: var(--nv-bg);
  transition: transform 80ms cubic-bezier(.2,0,0,1);
}
[data-utility-button]:active { transform: scale(.94); }
@media (prefers-reduced-motion: reduce) {
  [data-utility-button] { transition: none; }
  [data-utility-button]:active { transform: none; }
}
[data-overlay-hint] { width: 232px; }
/* An open comment thread can run past a short file: keep it above the next
   file's margin items instead of under them. */
[data-overlay-item]:has([data-overlay-body]:not([data-dismissed], [data-empty])) {
  z-index: 3;
}
/* +/− live in the gutter, which Pierre pins while a file scrolls sideways
   (Wrap off), so the sign never scrolls away from its line number. */
[data-indicators='classic'] [data-line]::before { content: none; }
[data-indicators='classic'] [data-line] { padding-inline-start: 1ch; }
[data-indicators='classic'] [data-column-number] { padding-inline-end: 2.2ch; }
[data-indicators='classic'] [data-column-number]:is([data-line-type='change-addition'], [data-line-type='change-deletion'])::after {
  position: absolute; top: 0; right: 0.6ch; width: 1ch; text-align: center;
  user-select: none; pointer-events: none;
}
[data-indicators='classic'] [data-column-number][data-line-type='change-addition']::after {
  content: '+'; color: var(--diffs-addition-base);
}
[data-indicators='classic'] [data-column-number][data-line-type='change-deletion']::after {
  content: '−'; color: var(--diffs-deletion-base);
}
@media (max-width: 1180px) { :host { --diffs-overlay-width: 260px; } }
@media (max-width: 860px) {
  [data-annotation-overlay] {
    inset-inline-start: auto;
    inset-inline-end: 8px;
    width: min(220px, 60%);
  }
}
`

export type DiffVariant = "review" | "read-only"

export interface DiffPresentation {
  /** Stacked (unified) or split (removed and added rows side by side). */
  layout: "stacked" | "split"
  /** Wrap long lines; off scrolls each file sideways, gutter pinned. */
  wrap: boolean
}

export const DEFAULT_PRESENTATION: DiffPresentation = {
  layout: "stacked",
  wrap: true,
}

export function diffOptions(
  variant: DiffVariant,
  presentation: DiffPresentation = DEFAULT_PRESENTATION
): FileDiffOptions<undefined, undefined> {
  return {
    theme: NEUVE_DIFF_THEME,
    themeType: "light",
    diffStyle: presentation.layout === "split" ? "split" : "unified",
    // Classic +/− signs: the design bans coloured edge rails.
    diffIndicators: "classic",
    hunkSeparators: "line-info",
    disableFileHeader: true,
    annotationLayout: "overlay",
    overflow: presentation.wrap ? "wrap" : "scroll",
    lineDiffType: variant === "review" ? "word-alt" : "none",
    expansionLineCount: 20,
    unsafeCSS: SURFACE_CSS,
  }
}

let pool: WorkerPoolManager | undefined | null = null

/**
 * The shared highlighting worker pool, created on first use in a browser.
 * Returns undefined on the server or where workers are unavailable; the
 * renderer then highlights on the main thread.
 */
export function getDiffWorkerPool(): WorkerPoolManager | undefined {
  if (pool !== null) return pool
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return undefined
  }
  ensureNeuveDiffTheme()
  try {
    pool = getOrCreateWorkerPoolSingleton({
      poolOptions: {
        poolSize: 2,
        workerFactory: () => new DiffsWorker(),
      },
      highlighterOptions: {
        theme: NEUVE_DIFF_THEME,
        langs: ["typescript", "tsx"],
        lineDiffType: "word-alt",
      },
    })
  } catch {
    pool = undefined
  }
  return pool
}
