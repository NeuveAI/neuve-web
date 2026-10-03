import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { Briefing } from "@workspace/ui/neuve/review-desk/briefing"
import { withReviewDeskState } from "@workspace/ui/neuve/review-desk/story-state"
import { UnitRail } from "@workspace/ui/neuve/review-desk/unit-rail"
import { AppHeader } from "@workspace/ui/neuve/shared/app-header"

const paper = "bg-paper font-sans text-sm text-ink"

const meta = {
  title: "Review desk/Chrome",
  component: UnitRail,
  args: { data: reviewDeskFixture },
} satisfies Meta<typeof UnitRail>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Header: logo, repo / branch, commit chip, Agents control, Find ⌘K, theme.
 * The human gate and Units/Files moved into the unit column.
 */
export const Header: Story = {
  decorators: [withReviewDeskState()],
  render: (args) => (
    <div className={paper}>
      <AppHeader
        repo={args.data.repo}
        branch={args.data.branch}
        commit={args.data.revision}
      />
    </div>
  ),
}

const rail = (args: { data: typeof reviewDeskFixture }) => (
  <div className={`${paper} flex h-[720px] w-[300px]`}>
    <UnitRail data={args.data} />
  </div>
)

/**
 * Rail: gate meter beside "Needs your decision", agent tags (I1, I2), the
 * current unit selected by tone, "Decided by agents and tools".
 */
export const Rail: Story = {
  decorators: [withReviewDeskState({ railCollapsed: false })],
  render: rail,
}
export const RailApproved: Story = {
  decorators: [withReviewDeskState({ dock: "approved", railCollapsed: false })],
  render: rail,
}
export const RailChangesRequested: Story = {
  decorators: [
    withReviewDeskState({ dock: "changes-requested", railCollapsed: false }),
  ],
  render: rail,
}

/**
 * Collapsed: a 60px column of identical 36px buttons — expand, back,
 * divider, units to decide as their lane glyph, divider, lane groups with a
 * count badge. Names are tooltips.
 */
export const RailCollapsed: Story = {
  decorators: [withReviewDeskState({ railCollapsed: true })],
  render: rail,
  play: async ({ canvasElement }) => {
    const nav = canvasElement.querySelector("nav")!
    await expect(nav.getBoundingClientRect().width).toBe(60)
    const buttons = Array.from(nav.querySelectorAll<HTMLElement>("button, a"))
    for (const button of buttons) {
      const box = button.getBoundingClientRect()
      await expect([box.width, box.height]).toEqual([36, 36])
    }
  },
}

/** The play collapses with the button, then expands again with "[". */
export const RailCollapseToggle: Story = {
  decorators: [withReviewDeskState({ railCollapsed: false })],
  render: rail,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const nav = canvasElement.querySelector("nav")!
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse sidebar" })
    )
    await waitFor(() => expect(nav.getBoundingClientRect().width).toBe(60))
    await expect(nav.hasAttribute("data-collapsed")).toBe(true)
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand sidebar" })
    )
    await waitFor(() =>
      expect(nav.getBoundingClientRect().width).toBeGreaterThan(200)
    )
  },
}

/**
 * A shared marker is pointed at (Graph, shared with two suggested units):
 * the Suggested group tone-shifts and shows one dot per linked unit.
 */
export const RailLinkedFromGraph: Story = {
  decorators: [
    withReviewDeskState({
      railCollapsed: false,
      hoverHint: { filePath: "src/sharing/revoke.ts", markerKey: "graph" },
    }),
  ],
  render: rail,
}

/** The open Doc card links the admins unit: it tone-shifts with a link glyph. */
export const RailLinkedFromDoc: Story = {
  decorators: [
    withReviewDeskState({ railCollapsed: false, openMarker: "doc" }),
  ],
  render: rail,
  play: async ({ canvas }) => {
    const admins = canvas.getByRole("link", {
      name: /Workspace admins may revoke any link/,
    })
    await expect(admins).toHaveAttribute("data-linked")
    await expect(
      canvas.getByRole("img", { name: "Shares the open context" })
    ).toBeVisible()
  },
}

/** Collapsed rail with a linked lane group (tone shift on the icon button). */
export const RailCollapsedLinked: Story = {
  decorators: [
    withReviewDeskState({ railCollapsed: true, openMarker: "conflict" }),
  ],
  render: rail,
}

/** Briefing with numbered citations that open margin cards. */
export const BriefingWithCitations: Story = {
  decorators: [withReviewDeskState()],
  render: (args) => (
    <div className={paper}>
      <Briefing unit={args.data.unit} />
    </div>
  ),
}

/**
 * Lane groups expand in place to list their units (Lanes.dc.html); a unit
 * links to its desk. The play opens Suggested, checks a unit's link, and
 * closes it again.
 */
export const RailLaneGroupExpand: Story = {
  decorators: [withReviewDeskState({ railCollapsed: false })],
  render: rail,
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole("button", { name: /Suggested/ })
    await expect(group).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(group)
    const list = await canvas.findByRole("list", { name: "Suggested units" })
    const audit = within(list).getByRole("listitem", {
      name: /Audit event for revocation/,
    })
    await expect(audit).toHaveAttribute(
      "href",
      "/review/audit-event-for-revocation"
    )
    await userEvent.click(group)
    await waitFor(() =>
      expect(canvas.queryByRole("list", { name: "Suggested units" })).toBeNull()
    )
  },
}

/** Agentic review open, with the unit sent back in red. */
export const RailLaneGroupsOpen: Story = {
  decorators: [
    withReviewDeskState({
      railCollapsed: false,
      openLanes: ["human-suggested", "agentic-review", "static-automation"],
    }),
  ],
  render: rail,
}

/** From the collapsed rail, a lane glyph expands the rail with that lane open. */
export const RailCollapsedLaneOpens: Story = {
  decorators: [withReviewDeskState({ railCollapsed: true })],
  render: rail,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Agentic review · 7 units" })
    )
    await canvas.findByRole("list", { name: "Agentic review units" })
  },
}
