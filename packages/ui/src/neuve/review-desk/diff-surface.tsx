import * as React from "react"
import { useAtomValue } from "jotai"
import { FileDiff, VirtualizedFileDiff } from "@workspace/diffs"
import type {
  AnnotationOverlayHighlight,
  AnnotationOverlayState,
  DiffLineAnnotation,
  FileDiffMetadata,
  FileDiffOptions,
  SelectedLineRange,
} from "@workspace/diffs"

import {
  DIFF_METRICS,
  diffOptions,
  ensureNeuveDiffTheme,
  getDiffWorkerPool,
} from "@workspace/ui/lib/diffs"
import type { DiffVariant } from "@workspace/ui/lib/diffs"
import { cn } from "@workspace/ui/lib/utils"
import {
  diffVirtualizerAtom,
  effectiveLayoutAtom,
  wrapAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import type { LineRange } from "@workspace/ui/neuve/types"

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      /** Host element of the @workspace/diffs renderer (shadow DOM). */
      "diffs-container": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }
  }
}

export interface DiffSurfaceProps {
  fileDiff: FileDiffMetadata
  /** Overlay annotations; `id` keys pin/body slots and overlay state. */
  annotations: Array<DiffLineAnnotation>
  overlay: {
    expandedId: string | undefined
    dismissedIds: ReadonlyArray<string>
    hintId: string | undefined
    /** Another file's layer is expanded: dim and disable this one too. */
    isolated?: boolean
    /** Lines tinted on the code for an open or pointed-at comment. */
    highlight?: { range: LineRange; tone: "strong" | "hint" }
  }
  variant?: DiffVariant
  /**
   * The gutter selection (controlled from jotai). Pierre's own selection
   * machinery draws it and reports changes through `onSelectLines`.
   */
  selection?: LineRange | null
  /** Live while dragging, on click, Shift+click, keys and touch. */
  onSelectLines?: (range: LineRange | null) => void
  /** Enter / C on a line number, or the gutter "+": comment on these lines. */
  onCommitLines?: (range: LineRange) => void
  /** Accessible name of the code region. */
  label: string
  className?: string
  /** Slotted overlay content: pins, bodies and the shared hint. */
  children?: React.ReactNode
}

type Instance = FileDiff | VirtualizedFileDiff

function toLineRange(range: SelectedLineRange | null): LineRange | null {
  if (range === null) return null
  const side = range.side ?? "additions"
  return {
    start: range.start,
    side,
    end: range.end,
    ...(range.endSide && range.endSide !== side
      ? { endSide: range.endSide }
      : {}),
  }
}

/**
 * React host for the forked Pierre renderer.
 *
 * The vanilla instance owns the shadow DOM (code rows, gutter selection and
 * the overlay layer); React owns the light-DOM children it slots into the
 * layer. The instance is created when the host element attaches (a ref
 * callback, so it never runs on the server) and updated from props after
 * each commit. When the review desk provides a Virtualizer the surface is
 * virtualized; otherwise every row renders (component stories).
 */
export function DiffSurface({
  fileDiff,
  annotations,
  overlay,
  variant = "review",
  selection = null,
  onSelectLines,
  onCommitLines,
  label,
  className,
  children,
}: DiffSurfaceProps) {
  const virtualizer = useAtomValue(diffVirtualizerAtom)
  const commentable = onSelectLines !== undefined
  // Stacked/Split and Wrap are Pierre's own diffStyle and overflow options;
  // a change rebuilds the renderer (the ref callback below depends on them).
  const layout = useAtomValue(effectiveLayoutAtom)
  const wrap = useAtomValue(wrapAtom)
  const instanceRef = React.useRef<Instance | null>(null)
  const hostRef = React.useRef<HTMLElement | null>(null)
  // Latest callbacks for the vanilla instance (assigned after commit).
  const callbacks = React.useRef({ onSelectLines, onCommitLines })

  const attach = React.useCallback(
    (host: HTMLElement | null) => {
      // Inside the review desk, wait for its Virtualizer instead of building
      // a renderer that would be replaced one commit later.
      if (host === null || virtualizer === "pending") return
      ensureNeuveDiffTheme()
      // Any surface that takes comments (a unit's file or a read-only
      // neighbor) makes its gutter the comment surface.
      const onSelectLinesPresent = commentable
      const select = (range: SelectedLineRange | null) =>
        callbacks.current.onSelectLines?.(toLineRange(range))
      const commit = (range: SelectedLineRange) => {
        const next = toLineRange(range)
        if (next) callbacks.current.onCommitLines?.(next)
      }
      const options: FileDiffOptions<undefined, undefined> = {
        ...diffOptions(variant, { layout, wrap }),
        ...(onSelectLinesPresent
          ? {
              // Pierre's line selection, extended in the fork with keyboard
              // and touch: the gutter is the comment surface.
              enableLineSelection: true,
              enableKeyboardLineSelection: true,
              touchTapExtendsSelection: true,
              lineHoverHighlight: "number" as const,
              enableGutterUtility: true,
              onLineSelectionChange: select,
              onLineSelected: select,
              onLineSelectionCommit: commit,
              onGutterUtilityClick: commit,
            }
          : {}),
      }
      const pool = getDiffWorkerPool()
      const instance: Instance = virtualizer
        ? new VirtualizedFileDiff(
            options,
            virtualizer,
            DIFF_METRICS,
            pool,
            true
          )
        : new FileDiff(options, pool, true)
      // Exposed for stories and tests (which renderer is mounted).
      host.dataset.virtualized = virtualizer ? "true" : "false"
      host.dataset.layout = layout
      host.dataset.wrap = wrap ? "true" : "false"
      hostRef.current = host
      instanceRef.current = instance
      return () => {
        instance.cleanUp()
        // The host stays mounted (React owns it); drop the old shadow content
        // so a replacement instance starts from an empty root.
        host.shadowRoot?.replaceChildren()
        instanceRef.current = null
        hostRef.current = null
      }
    },
    [virtualizer, variant, layout, wrap, commentable]
  )

  const {
    expandedId,
    dismissedIds,
    hintId,
    isolated = false,
    highlight,
  } = overlay
  const dismissedKey = dismissedIds.join("\u0000")
  const selectionKey = selection ? JSON.stringify(selection) : ""
  const highlightKey = highlight ? JSON.stringify(highlight) : ""

  // Effect: syncs the vanilla diff renderer (an external system) with committed props, the allowed "synchronize with an external system" case.
  React.useLayoutEffect(() => {
    callbacks.current = { onSelectLines, onCommitLines }
    const instance = instanceRef.current
    const host = hostRef.current
    if (!instance || !host) return
    instance.render({
      fileContainer: host,
      fileDiff,
      lineAnnotations: annotations,
    })
    const nextSelection: SelectedLineRange | null = selectionKey
      ? (JSON.parse(selectionKey) as SelectedLineRange)
      : null
    // notify: false — this is the echo of state that came from the gutter.
    instance.setSelectedLines(nextSelection, { notify: false })
    const state: Partial<AnnotationOverlayState> = {
      expandedId,
      dismissedIds: dismissedKey ? dismissedKey.split("\u0000") : [],
      hintId,
      isolated,
      highlight: highlightKey
        ? (JSON.parse(highlightKey) as AnnotationOverlayHighlight)
        : undefined,
    }
    instance.setAnnotationOverlayState(state)
  }, [
    attach,
    fileDiff,
    annotations,
    expandedId,
    dismissedKey,
    hintId,
    isolated,
    selectionKey,
    highlightKey,
    onSelectLines,
    onCommitLines,
  ])

  return (
    <diffs-container
      ref={attach}
      role="region"
      aria-label={label}
      className={cn(
        "nv-diff block",
        variant === "read-only" && "nv-diff-readonly",
        className
      )}
    >
      {children}
    </diffs-container>
  )
}
