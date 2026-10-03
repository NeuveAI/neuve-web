import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import {
  reviewCommentFixtures,
  reviewDeskFixture,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import {
  CommentBody,
  ContextCard,
  MarginPin,
} from "@workspace/ui/neuve/review-desk/context-margin"
import { DiffFileCard } from "@workspace/ui/neuve/review-desk/diff-file"
import {
  onPaper,
  withReviewDeskState,
} from "@workspace/ui/neuve/review-desk/story-state"
import { reviewCommentToMarker } from "@workspace/ui/neuve/review-comments/markers"
import type { ContextualMarker } from "@workspace/ui/neuve/types"

const markers = reviewDeskFixture.markers
const marker = (key: string): ContextualMarker => {
  const found = markers[key]
  if (!found) throw new Error(`Unknown fixture marker ${key}`)
  return found
}
const revokeFile = reviewDeskFixture.files[0]!
const commentContext = {
  unitId: reviewDeskFixture.unit.id,
  revision: reviewDeskFixture.revision,
  author: reviewDeskFixture.reviewer,
}
const commentMarker = reviewCommentToMarker(reviewCommentFixtures[0]!)

/* ── L0 pins ───────────────────────────────────────────── */

const pinMeta = {
  title: "Review desk/Context margin (L0–L2)",
  component: MarginPin,
  decorators: [onPaper],
  args: {
    marker: marker("conflict"),
    on: false,
    disabled: false,
    onToggle: fn(),
    onHintStart: fn(),
    onHintEnd: fn(),
  },
} satisfies Meta<typeof MarginPin>

export default pinMeta
type PinStory = StoryObj<typeof pinMeta>

/**
 * Every source tone side by side: doc, graph, conflict, same batch, test,
 * history — then a review comment, which is a pill with a speech glyph and
 * initials instead of a source tone (it is not retrieved context).
 */
export const AllTones: PinStory = {
  render: (args) => (
    <div className="flex flex-wrap gap-1.5">
      {Object.values(markers).map((m) => (
        <MarginPin key={m.key} {...args} marker={m} />
      ))}
      <MarginPin {...args} marker={commentMarker} />
    </div>
  ),
}

/** A `review comment` marker pin (open body). */
export const ReviewComment: PinStory = {
  args: { marker: commentMarker, on: true },
}

export const Conflict: PinStory = {}
export const SameBatch: PinStory = { args: { marker: marker("batch") } }
export const Test: PinStory = { args: { marker: marker("test") } }
export const Committed: PinStory = { args: { marker: marker("doc") } }
/** The pin whose card is open: inverted ink tone, aria-expanded. */
export const On: PinStory = { args: { on: true } }
/** Another card is isolating the margin: no pointer, out of tab order (dimmed by its row). */
export const Disabled: PinStory = {
  args: { disabled: true },
  render: (args) => (
    <div className="opacity-35">
      <MarginPin {...args} />
    </div>
  ),
}

/* ── L2 cards ──────────────────────────────────────────── */

const cardFrame = (m: ContextualMarker) => (
  <div className="relative h-[460px] w-[320px]">
    <ContextCard marker={m} onClose={fn()} onOpenSource={fn()} />
  </div>
)

export const CardConflictingIntent: PinStory = {
  render: () => cardFrame(marker("conflict")),
}
export const CardSameBatch: PinStory = {
  render: () => cardFrame(marker("batch")),
}
export const CardEvidenceGap: PinStory = {
  render: () => cardFrame(marker("test")),
}
export const CardDocumentation: PinStory = {
  render: () => cardFrame(marker("doc")),
}
export const CardCommittedGraph: PinStory = {
  render: () => cardFrame(marker("graph")),
}
export const CardRegressionHistory: PinStory = {
  render: () => cardFrame(marker("history")),
}

/** The open body of a review comment, as it floats in the overlay. */
export const CommentBodyOpen: PinStory = {
  render: () => (
    <div className="w-[268px]">
      <CommentBody
        marker={commentMarker}
        status="open"
        onDismiss={fn()}
        onToggleStatus={fn()}
      />
    </div>
  ),
}

/* ── File + margin together ────────────────────────────── */

const fileFrame = () => (
  <div className="max-w-[1100px]">
    <DiffFileCard
      file={revokeFile}
      markers={markers}
      commentContext={commentContext}
    />
  </div>
)

/** Rest: dotted L0 underlines and pins, nothing open. */
export const FileWithMargin: PinStory = {
  decorators: [withReviewDeskState()],
  render: fileFrame,
}

/** Isolation: graph card open, its row ringed, every other pin dimmed and disabled. */
export const FileWithCardOpen: PinStory = {
  decorators: [withReviewDeskState({ openMarker: "graph" })],
  render: fileFrame,
}

/** L1: one shared hint layer per margin, under the hovered pin. */
export const FileWithHoverHint: PinStory = {
  decorators: [
    withReviewDeskState({
      hoverHint: { filePath: revokeFile.path, markerKey: "conflict" },
    }),
  ],
  render: fileFrame,
}
