import type { Meta, StoryObj } from "@storybook/react-vite"

import { BrandMark } from "@workspace/ui/neuve/shared/brand-mark"
import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import { Segmented } from "@workspace/ui/neuve/shared/segmented"
import { ThemeToggle } from "@workspace/ui/neuve/shared/theme-toggle"
import type { ReviewLane } from "@workspace/ui/neuve/types"

const meta = {
  title: "Shared",
  component: BrandMark,
  decorators: [
    (Story) => (
      <div className="min-h-svh bg-paper p-8 font-sans text-sm text-ink">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrandMark>

export default meta
type Story = StoryObj<typeof meta>

export const Brand: Story = {}

/** Toggles `.dark` on <html>; also driven by the toolbar theme switch. */
export const ThemeSwitch: Story = { render: () => <ThemeToggle /> }

const LANES: Array<[ReviewLane, string]> = [
  ["human-required", "Human-required"],
  ["human-suggested", "Human-suggested"],
  ["agentic-review", "Agentic review"],
  ["static-automation", "Static automation"],
]

export const LaneGlyphs: Story = {
  render: () => (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {LANES.map(([lane, label]) => (
        <li key={lane} className="flex items-center gap-2.5">
          <LaneGlyph lane={lane} />
          {label}
        </li>
      ))}
    </ul>
  ),
}

/** Only the current mode is enabled until Files and Split are designed. */
export const SegmentedControl: Story = {
  render: () => (
    <div className="flex gap-4">
      <Segmented label="Browse by" options={["Units", "Files"]} value="Units" />
      <Segmented
        label="Diff layout"
        options={["Stacked", "Split"]}
        value="Stacked"
      />
    </div>
  ),
}
