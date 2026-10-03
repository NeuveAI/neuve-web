import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"

import {
  crossSideCommentFixture,
  longFileCommentFixtures,
  longFileDeskFixture,
  reviewCommentFixtures,
  reviewDeskFixture,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReviewDeskScreen } from "@workspace/ui/neuve/review-desk/review-desk-screen"
import { commentMarkerKey } from "@workspace/ui/neuve/review-comments/markers"
import {
  createLocalReviewCommentRepository,
  createMemoryReviewCommentRepository,
} from "@workspace/ui/neuve/review-comments/repository"

/**
 * The context margin as the forked diff renderer's overlay layer.
 *
 * Pins, comment bodies, the L2 card, the comment composer and the shared
 * hint all render in a positioned layer beside the code (annotationLayout:
 * 'overlay' in @workspace/diffs); the code rows never move. Each story seeds
 * one state; everything is also reachable by pointer and keyboard from
 * `LayerOpen`.
 */
const meta = {
  title: "Review desk/Overlay annotations",
  component: ReviewDeskScreen,
  args: {
    data: reviewDeskFixture,
    commentRepository: createMemoryReviewCommentRepository(
      reviewCommentFixtures
    ),
  },
  argTypes: { commentRepository: { control: false } },
} satisfies Meta<typeof ReviewDeskScreen>

export default meta
type Story = StoryObj<typeof meta>

const SESSIONS_COMMENT = commentMarkerKey("rc_seed_sessions")
const EARLIER_COMMENT = commentMarkerKey("rc_seed_earlier")
const POLICY_COMMENT = commentMarkerKey("rc_seed_policy")

/** Shadow root of the first diff host on the page. */
function diffRoot(canvas: HTMLElement, index = 0) {
  const host = canvas.ownerDocument.querySelectorAll("diffs-container")[index]
  return host?.shadowRoot ?? null
}

/**
 * Layer open: two review comments show as compact previews ("Show
 * comments") and the conflict card is the one expanded layer — on its own anchor row, every
 * other item (in every file) dimmed and inert, the row ringed. An outside
 * click (the dismiss layer) or Escape collapses it; nothing else moves.
 */
export const LayerOpen: Story = {
  args: {
    initialState: {
      openMarker: "conflict",
      openBodies: [SESSIONS_COMMENT, POLICY_COMMENT],
    },
  },
}

/**
 * Dismissed: the session comment is back to its pin (L0); its pin (click,
 * Enter or Space) opens its thread. The earlier-revision comment on +21
 * shows as a compact preview.
 */
export const LayerDismissed: Story = {
  args: { initialState: { openBodies: [EARLIER_COMMENT] } },
}

/**
 * Dismiss all: every comment preview is shown and the conflict card is open;
 * the play uses "Dismiss all" — previews collapse to their pins and the card
 * closes. "Show comments" brings the previews back.
 */
export const DismissAll: Story = {
  args: {
    initialState: {
      openMarker: "conflict",
      openBodies: [SESSIONS_COMMENT, EARLIER_COMMENT, POLICY_COMMENT],
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const dismissAll = await canvas.findByRole("button", {
      name: "Dismiss all",
    })
    await userEvent.click(dismissAll)
    await canvas.findByRole("button", { name: "Show comments" })
    // The layer's own state (not the exit animation): no open body remains
    // in any file, and nothing is expanded.
    await waitFor(() => {
      for (const host of canvasElement.ownerDocument.querySelectorAll(
        "diffs-container"
      )) {
        const root = host.shadowRoot
        expect(
          root?.querySelectorAll(
            "[data-overlay-body]:not([data-dismissed]):not([data-empty])"
          ).length ?? 0
        ).toBe(0)
        expect(
          root?.querySelector("[data-overlay-item][data-expanded]")
        ).toBeNull()
      }
    })
  },
}

/* ── Gutter commenting: helpers for play functions ─────── */

const REVOKE = "src/sharing/revoke.ts"

type Side = "additions" | "deletions"

interface CellSpec {
  side: Side
  line: number
}

/** The line-number cell of a (side, line) in the first diff host, now. */
function findCell(canvas: HTMLElement, { side, line }: CellSpec) {
  const type =
    side === "deletions"
      ? "[data-line-type='change-deletion']"
      : ":is([data-line-type='change-addition'], [data-line-type='context'], [data-line-type='context-expanded'])"
  return (
    diffRoot(canvas)?.querySelector<HTMLElement>(
      `[data-column-number="${line}"]${type}`
    ) ?? null
  )
}

/**
 * Wait until a cell exists and the diff has settled (highlighting can
 * replace rows once, so cells are always looked up fresh by spec).
 */
async function gutterCell(canvas: HTMLElement, spec: CellSpec) {
  await waitFor(
    () => {
      expect(findCell(canvas, spec)).toBeTruthy()
      expect(
        diffRoot(canvas)?.querySelector(
          "[data-content] [data-line] span[style]"
        )
      ).toBeTruthy()
    },
    { timeout: 8000 }
  )
  await new Promise((resolve) => setTimeout(resolve, 150))
  return findCell(canvas, spec)!
}

function centre(element: Element) {
  const rect = element.getBoundingClientRect()
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }
}

function pointer(
  target: EventTarget,
  type: string,
  at: { clientX: number; clientY: number },
  init: PointerEventInit = {}
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      ...at,
      ...init,
    })
  )
}

/** Press, drag through `path`, release — as a mouse or a finger would. */
async function dragGutter(
  canvas: HTMLElement,
  from: CellSpec,
  path: Array<CellSpec>,
  init: PointerEventInit = {}
) {
  const doc = canvas.ownerDocument
  const start = await gutterCell(canvas, from)
  pointer(start, "pointerdown", centre(start), init)
  for (const spec of path) {
    await new Promise((resolve) => setTimeout(resolve, 40))
    pointer(doc, "pointermove", centre(findCell(canvas, spec)!), init)
  }
  await new Promise((resolve) => setTimeout(resolve, 40))
  const last = findCell(canvas, path.at(-1) ?? from)!
  pointer(doc, "pointerup", centre(last), init)
}

function selectedRows(canvas: HTMLElement) {
  return Array.from(
    diffRoot(canvas)?.querySelectorAll("[data-content] [data-selected-line]") ??
      []
  )
}

const chip = (canvas: HTMLElement) =>
  canvas.ownerDocument.querySelector<HTMLButtonElement>(
    'button[aria-label^="Comment on L"]'
  )

function key(target: Element, keyName: string, shiftKey = false) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: keyName,
      shiftKey,
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  )
}

/**
 * Select a single line: click a line number. The row tints (gutter and
 * code) and a "Comment · L22" chip springs in at that line. Hovering or
 * focusing a line number shows the gutter "+" and a tone shift.
 */
export const SelectSingleLine: Story = {
  play: async ({ canvasElement }) => {
    await dragGutter(canvasElement, { side: "additions", line: 22 }, [])
    await waitFor(() => expect(selectedRows(canvasElement)).toHaveLength(1))
    await waitFor(() => expect(chip(canvasElement)?.textContent).toMatch(/L22/))
  },
}

/**
 * Drag a range: press on −20 and drag down to +23 — the selection crosses
 * from deletion to addition rows (stacked view) and updates live; the chip
 * sits on the last line.
 */
export const DragRange: Story = {
  play: async ({ canvasElement }) => {
    await dragGutter(canvasElement, { side: "deletions", line: 20 }, [
      { side: "deletions", line: 21 },
      { side: "additions", line: 20 },
      { side: "additions", line: 21 },
      { side: "additions", line: 22 },
      { side: "additions", line: 23 },
    ])
    await waitFor(() => expect(selectedRows(canvasElement)).toHaveLength(6))
    await waitFor(() =>
      expect(chip(canvasElement)?.textContent).toMatch(/L−20–\+?23/)
    )
  },
}

/** Shift+click extends from the anchor: click +21, Shift+click +24. */
export const ShiftExtend: Story = {
  play: async ({ canvasElement }) => {
    await dragGutter(canvasElement, { side: "additions", line: 21 }, [])
    await dragGutter(canvasElement, { side: "additions", line: 24 }, [], {
      shiftKey: true,
    })
    await waitFor(() => expect(selectedRows(canvasElement)).toHaveLength(4))
    await waitFor(() =>
      expect(chip(canvasElement)?.textContent).toMatch(/L21–24/)
    )
  },
}

/**
 * Keyboard: the gutter has one tab stop. Space selects the focused line,
 * Shift+↓ extends, Enter (or C) opens the composer on the range.
 */
export const KeyboardRange: Story = {
  play: async ({ canvasElement }) => {
    const start = await gutterCell(canvasElement, {
      side: "additions",
      line: 21,
    })
    start.focus()
    key(start, " ")
    key(start, "ArrowDown", true)
    key(
      findCell(canvasElement, { side: "additions", line: 22 })!,
      "ArrowDown",
      true
    )
    const last = findCell(canvasElement, { side: "additions", line: 23 })!
    await waitFor(() => expect(selectedRows(canvasElement)).toHaveLength(3))
    key(last, "Enter")
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector(
          '[role="dialog"][aria-label*="lines 21–23"]'
        )
      ).toBeTruthy()
    )
  },
}

/**
 * Composer on a range: anchored to the first selected line, the range stays
 * tinted on the code, other margin items are isolated. The header is a
 * quiet label; dragging in the gutter re-targets it.
 */
export const ComposerOpenOnRange: Story = {
  args: {
    initialState: {
      lineSelection: {
        filePath: REVOKE,
        range: { start: 21, side: "additions", end: 23 },
      },
      composer: {
        filePath: REVOKE,
        range: { start: 21, side: "additions", end: 23 },
      },
    },
  },
}

/**
 * Escape with text sets the draft aside: the composer collapses to a
 * "Draft L21–23" pin; clicking it brings the composer and text back.
 */
export const DraftCollapsedToPin: Story = {
  args: {
    initialState: {
      parkedDrafts: [
        {
          id: `${REVOKE}#additions:21-additions:23`,
          filePath: REVOKE,
          range: { start: 21, side: "additions", end: 23 },
          text: "Order matters here: invalidate sessions before bumping the version?",
        },
      ],
    },
  },
}

/**
 * Saved range comments: pins show their range ("L22–23", "L−20–20") and
 * the author. The open one tints its lines on the code; pointing at a pin
 * tints them lightly through the shared hint layer.
 */
export const SavedRangeComment: Story = {
  args: {
    commentRepository: createMemoryReviewCommentRepository([
      reviewCommentFixtures[0]!,
      crossSideCommentFixture,
    ]),
    initialState: { openMarker: SESSIONS_COMMENT },
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          diffRoot(canvasElement)?.querySelectorAll(
            "[data-content] [data-overlay-range='strong']"
          ).length
        ).toBe(2),
      { timeout: 8000 }
    )
  },
}

/** Touch: tap a line number to select, tap another to extend. */
export const Touch: Story = {
  play: async ({ canvasElement }) => {
    await dragGutter(canvasElement, { side: "additions", line: 20 }, [], {
      pointerType: "touch",
    })
    await dragGutter(canvasElement, { side: "additions", line: 22 }, [], {
      pointerType: "touch",
    })
    await waitFor(() => expect(selectedRows(canvasElement)).toHaveLength(3))
  },
}

/**
 * A saved comment as a contextual marker: `review comment` source kind, a
 * distinct pill pin, its body in the margin, traceable to its record and
 * revision — and attachable to a change request like any marker.
 */
export const SavedCommentAsMarker: Story = {
  args: {
    commentRepository: createMemoryReviewCommentRepository([
      reviewCommentFixtures[0]!,
    ]),
    initialState: {
      dock: "composing",
      attachment: SESSIONS_COMMENT,
      openMarker: SESSIONS_COMMENT,
    },
  },
}

/**
 * Persistence: comments here go to browser storage under a story-only key.
 * Add one (gutter "+" or Comment), save, then reload the page — it comes
 * back from storage as the same marker.
 */
export const LocalPersistence: Story = {
  args: {
    commentRepository: createLocalReviewCommentRepository(
      "neuve.review-comments.storybook"
    ),
  },
}

/**
 * Long file, virtualized: 2,400 lines in one diff host. Only rows near the
 * viewport are in the DOM; the overlay items for lines far below are placed
 * from the virtual layout and stay aligned while scrolling.
 */
export const LongFileVirtualized: Story = {
  args: {
    data: longFileDeskFixture,
    commentRepository: createMemoryReviewCommentRepository(
      longFileCommentFixtures
    ),
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const rows = diffRoot(canvasElement)?.querySelectorAll(
          "[data-content] [data-line]"
        )
        expect(rows?.length ?? 0).toBeGreaterThan(0)
        // Virtualized: far fewer rows than the file has lines.
        expect(rows?.length ?? 0).toBeLessThan(400)
      },
      { timeout: 8000 }
    )
  },
}

/**
 * Hunk expansion: the play expands the 17 folded lines above revoke.ts's
 * hunk (the same button works with Enter/Space). Rows are inserted above the
 * markers and the overlay follows them.
 */
export const HunkExpansion: Story = {
  play: async ({ canvasElement }) => {
    const button = await waitFor(
      () => {
        const found = diffRoot(canvasElement)?.querySelector<HTMLElement>(
          "[data-expand-button]"
        )
        expect(found).toBeTruthy()
        return found!
      },
      { timeout: 8000 }
    )
    button.click()
    await waitFor(
      () => {
        const root = diffRoot(canvasElement)
        expect(root?.querySelector("[data-separator='line-info']")).toBeNull()
      },
      { timeout: 4000 }
    )
  },
}

/** Two comments, one resolved: the resolved one starts out of the margin. */
const withOneResolved = [
  reviewCommentFixtures[0]!,
  { ...reviewCommentFixtures[1]!, status: "resolved" as const },
]

/**
 * Resolved comments are hidden: only the open comment's pin shows, and the
 * toolbar offers "1 resolved". The play reveals it (muted) and hides it again.
 */
export const ResolvedHidden: Story = {
  args: {
    commentRepository: createMemoryReviewCommentRepository(withOneResolved),
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = await canvas.findByRole("button", { name: /1 resolved/ })
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(toggle)
    await canvas.findByRole("button", { name: /Hide resolved/ })
    await userEvent.click(canvas.getByRole("button", { name: /Hide resolved/ }))
    await canvas.findByRole("button", { name: /1 resolved/ })
  },
}

/** The resolved comment revealed: its pin is muted beside open comments. */
export const ResolvedShown: Story = {
  args: {
    commentRepository: createMemoryReviewCommentRepository(withOneResolved),
    initialState: { showResolved: true },
  },
}
