import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"

import { agentRegistryFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { AgentsControl } from "@workspace/ui/neuve/agents/agents-control"
import { pendingAgentConnector } from "@workspace/ui/neuve/agents/atoms"
import type { AgentConnector } from "@workspace/ui/neuve/agents/atoms"
import {
  onPaper,
  withReviewDeskState,
} from "@workspace/ui/neuve/review-desk/story-state"
import type { AgentRegistry } from "@workspace/ui/neuve/types"

/** Connects quickly so the play can see the whole round trip. */
const quickConnector: AgentConnector = {
  connect: () =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ activity: "Idle" }), 400)
    ),
  disconnect: () => Promise.resolve(),
}

const meta = {
  title: "Agents/Agents control",
  component: AgentsControl,
  decorators: [
    (Story) => (
      <div className="flex justify-end">
        <Story />
      </div>
    ),
    onPaper,
  ],
} satisfies Meta<typeof AgentsControl>

export default meta
type Story = StoryObj<typeof meta>

/** Avatars side by side (never overlapped), "+1", "4 agents · 3 live". */
export const Rest: Story = {
  decorators: [withReviewDeskState()],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", {
        name: "4 agents on this branch, 3 connected",
      })
    ).toHaveTextContent("4 agents · 3 live")
  },
}

const twoAgents: AgentRegistry = {
  ...agentRegistryFixture,
  agents: agentRegistryFixture.agents.slice(0, 2),
}

/** Fewer than four agents: no "+N". */
export const TwoAgents: Story = {
  decorators: [withReviewDeskState({}, undefined, { agents: twoAgents })],
}

/** Popover: Implementers and Reviewers with scope, unit count, status. */
export const Open: Story = {
  decorators: [withReviewDeskState({}, undefined, { agentsOpen: true })],
}

/** R2 is starting on this machine. */
export const Connecting: Story = {
  decorators: [
    withReviewDeskState({}, undefined, {
      agentsOpen: true,
      agents: {
        ...agentRegistryFixture,
        connections: {
          ...agentRegistryFixture.connections,
          r2: { status: "connecting", harnessId: "eve-local" },
        },
      },
      agentConnector: pendingAgentConnector,
    }),
  ],
}

/**
 * Connect picks from configured agents only (never a typed command): the
 * play connects R2 with the eve local harness and waits for it to go live.
 */
export const ConnectFlow: Story = {
  decorators: [
    withReviewDeskState({}, undefined, {
      agentsOpen: true,
      agentConnector: quickConnector,
    }),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", {
      name: "Agents on this branch",
    })
    const r2 = within(
      within(dialog).getByRole("group", { name: "Reviewer 2 · Sessions" })
    )
    await userEvent.click(r2.getByRole("button", { name: "Connect" }))
    await userEvent.click(r2.getByRole("button", { name: "eve local harness" }))
    await expect(r2.getByRole("status")).toHaveTextContent("Connecting")
    await waitFor(() =>
      expect(r2.getByRole("button", { name: "Disconnect" })).toBeVisible()
    )
    await waitFor(() =>
      expect(
        body.getByRole("button", {
          name: "4 agents on this branch, 4 connected",
        })
      ).toBeVisible()
    )
  },
}

/** Disconnect warns that the agent's context is lost; thread history stays. */
export const DisconnectWarning: Story = {
  decorators: [withReviewDeskState({}, undefined, { agentsOpen: true })],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", {
      name: "Agents on this branch",
    })
    const i1 = within(
      within(dialog).getByRole("group", { name: "Implementer 1 · Sharing" })
    )
    await userEvent.click(i1.getByRole("button", { name: "Disconnect" }))
    await expect(i1.getByRole("alert")).toHaveTextContent(
      "I1 loses its working context. Thread history stays."
    )
  },
}
