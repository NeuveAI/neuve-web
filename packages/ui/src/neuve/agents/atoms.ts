import { atom } from "jotai"

import type {
  AgentConnection,
  AgentRegistry,
  BranchAgent,
} from "@workspace/ui/neuve/types"

/**
 * Agents on the branch: the registry (typed data in, never edited here) and
 * live connection status (jotai).
 *
 * Neuve owns roles, scopes and routing; the ACP connection carries none of
 * them. Connect picks a harness from the server-side registry by id — the
 * browser never supplies a command. There are no real ACP calls yet: the
 * connector is injectable and the default one is a local mock.
 *
 *   disconnected ── Connect (pick a configured agent) ──▶ connecting ──▶ connected
 *   connected ── Disconnect (warns: context lost, thread history stays) ──▶ disconnected
 */

export interface AgentConnector {
  connect: (agentId: string, harnessId: string) => Promise<{ activity: string }>
  disconnect: (agentId: string) => Promise<void>
}

const MOCK_CONNECT_MS = 1400

/** Local stand-in for the BFF's ACP connector. */
export const mockAgentConnector: AgentConnector = {
  connect: () =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ activity: "Idle" }), MOCK_CONNECT_MS)
    ),
  disconnect: () => Promise.resolve(),
}

/** A connector that never finishes connecting (stories of that state). */
export const pendingAgentConnector: AgentConnector = {
  connect: () => new Promise(() => {}),
  disconnect: () => Promise.resolve(),
}

const EMPTY_REGISTRY: AgentRegistry = {
  agents: [],
  configured: [],
  connections: {},
}

export const agentRegistryAtom = atom<AgentRegistry>(EMPTY_REGISTRY)
export const agentConnectionsAtom = atom<Record<string, AgentConnection>>({})
export const agentConnectorAtom = atom<AgentConnector>(mockAgentConnector)

/** The Agents popover. */
export const agentsOpenAtom = atom(false)
/** The agent whose Connect picker is open. */
export const connectPickerAtom = atom<string | null>(null)
/** The agent whose Disconnect warning is showing. */
export const confirmDisconnectAtom = atom<string | null>(null)

export function agentsHydration(
  registry: AgentRegistry,
  connector?: AgentConnector,
  open = false
) {
  return [
    [agentRegistryAtom, registry],
    [agentConnectionsAtom, registry.connections],
    [agentConnectorAtom, connector ?? mockAgentConnector],
    [agentsOpenAtom, open],
  ] as const
}

export function connectionOf(
  connections: Record<string, AgentConnection>,
  agentId: string
): AgentConnection {
  return connections[agentId] ?? { status: "disconnected" }
}

export const liveCountAtom = atom((get) => {
  const connections = get(agentConnectionsAtom)
  return get(agentRegistryAtom).agents.filter(
    (agent) => connectionOf(connections, agent.id).status === "connected"
  ).length
})

export const agentByIdAtom = atom((get) => {
  const byId: Record<string, BranchAgent> = {}
  for (const agent of get(agentRegistryAtom).agents) byId[agent.id] = agent
  return byId
})

function setConnection(
  connections: Record<string, AgentConnection>,
  agentId: string,
  next: AgentConnection
) {
  return { ...connections, [agentId]: next }
}

/** Connect an agent with a configured harness (by id only). */
export const connectAgentAtom = atom(
  null,
  async (get, set, agentId: string, harnessId: string) => {
    const configured = get(agentRegistryAtom).configured
    if (!configured.some((entry) => entry.id === harnessId)) return
    set(connectPickerAtom, null)
    set(
      agentConnectionsAtom,
      setConnection(get(agentConnectionsAtom), agentId, {
        status: "connecting",
        harnessId,
      })
    )
    const { activity } = await get(agentConnectorAtom).connect(
      agentId,
      harnessId
    )
    // A Disconnect while connecting wins.
    if (
      connectionOf(get(agentConnectionsAtom), agentId).status !== "connecting"
    )
      return
    set(
      agentConnectionsAtom,
      setConnection(get(agentConnectionsAtom), agentId, {
        status: "connected",
        harnessId,
        activity,
      })
    )
  }
)

/** After the warning: the agent's context is lost, its threads stay. */
export const disconnectAgentAtom = atom(
  null,
  async (get, set, agentId: string) => {
    set(confirmDisconnectAtom, null)
    set(
      agentConnectionsAtom,
      setConnection(get(agentConnectionsAtom), agentId, {
        status: "disconnected",
      })
    )
    await get(agentConnectorAtom).disconnect(agentId)
  }
)
