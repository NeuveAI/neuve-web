/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Agents control (Header.dc.html, Main.dc.html)
 *
 *    0ms   trigger hover/press: tone shift (surfaceTone 120ms, CSS)
 *    0ms   popover enters: opacity 0 → 1, y -4 → 0, scale .98 → 1
 *          (card 220ms, emphasized decelerate, origin top right)
 *  close   popover exits: opacity → 0, y → -4 (cardExit 160ms, accelerate)
 *    0ms   Connect: status dot turns golden, spinner turns (connecting)
 *  done    dot turns green, the avatar takes its role tint (surfaceTone)
 *    0ms   picker / disconnect warning rows rise: opacity 0 → 1, y -4 → 0
 *          (snappy spring)
 *
 * Reduced motion: opacity-only 150ms; the spinner stops (static glyph).
 * ───────────────────────────────────────────────────────── */

import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import { Button } from "@workspace/ui/components/button"
import {
  EASE,
  REDUCED_TRANSITION,
  SPRING,
  TIMING,
  ms,
} from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import { AgentAvatar } from "@workspace/ui/neuve/agents/agent-avatar"
import {
  agentConnectionsAtom,
  agentRegistryAtom,
  agentsOpenAtom,
  confirmDisconnectAtom,
  connectAgentAtom,
  connectPickerAtom,
  connectionOf,
  disconnectAgentAtom,
  liveCountAtom,
} from "@workspace/ui/neuve/agents/atoms"
import type {
  AgentConnection,
  AgentRole,
  BranchAgent,
} from "@workspace/ui/neuve/types"

const POPOVER = {
  offsetY: -4,
  initialScale: 0.98,
  enter: { duration: ms(TIMING.card), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.cardExit), ease: EASE.emphasizedAccelerate },
} as const

/** Avatars shown side by side before the "+N" count. */
const MAX_AVATARS = 3

const ROLE_LABEL: Record<AgentRole, string> = {
  implementer: "Implementers",
  reviewer: "Reviewers",
}

function statusText(connection: AgentConnection): string {
  if (connection.status === "connected") return connection.activity
  if (connection.status === "connecting") return "Starting on this machine…"
  return "Not connected"
}

function StatusDot({ connection }: { connection: AgentConnection }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 shrink-0 rounded-full transition-colors duration-120 motion-reduce:transition-none",
        connection.status === "connected" && "bg-agt",
        connection.status === "connecting" && "bg-brand",
        connection.status === "disconnected" && "bg-faint"
      )}
    />
  )
}

function RowReveal({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: REDUCED_TRANSITION }}
      transition={reduce ? REDUCED_TRANSITION : SPRING.snappy}
      className="col-span-3 col-start-2"
    >
      {children}
    </motion.div>
  )
}

function AgentRow({ agent }: { agent: BranchAgent }) {
  const connections = useAtomValue(agentConnectionsAtom)
  const registry = useAtomValue(agentRegistryAtom)
  const picker = useAtomValue(connectPickerAtom)
  const setPicker = useSetAtom(connectPickerAtom)
  const confirming = useAtomValue(confirmDisconnectAtom)
  const setConfirming = useSetAtom(confirmDisconnectAtom)
  const connect = useSetAtom(connectAgentAtom)
  const disconnect = useSetAtom(disconnectAgentAtom)
  const reduce = useReducedMotion()
  const connection = connectionOf(connections, agent.id)
  const harnesses = registry.configured.filter((entry) =>
    entry.roles.includes(agent.role)
  )
  const pickerOpen = picker === agent.id
  const warning = confirming === agent.id

  return (
    <div
      role="group"
      aria-label={`${agent.name} · ${agent.scope.label}`}
      className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3.5 py-[9px]"
    >
      <AgentAvatar
        agent={agent}
        connection={connection}
        size="default"
        badge={false}
        className="row-span-2"
      />
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-[13.5px] font-medium">{agent.scope.label}</span>
        <span className="rounded-sm bg-raised px-1.5 py-px font-mono text-[10.5px] whitespace-nowrap text-ink-2">
          {agent.unitCount} units
        </span>
      </span>
      <span className="row-span-2">
        {connection.status === "connected" && (
          <Button
            type="button"
            variant="raised"
            size="xs"
            className="h-7 px-2.5 text-xs font-normal"
            aria-expanded={warning}
            onClick={() => setConfirming(warning ? null : agent.id)}
          >
            Disconnect
          </Button>
        )}
        {connection.status === "connecting" && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
          >
            <LoaderCircleIcon
              aria-hidden="true"
              className={cn("size-3", !reduce && "animate-spin")}
            />
            Connecting
          </span>
        )}
        {connection.status === "disconnected" && (
          <Button
            type="button"
            variant="ink"
            size="xs"
            className="h-7 px-2.5 text-xs font-normal"
            aria-expanded={pickerOpen}
            onClick={() => setPicker(pickerOpen ? null : agent.id)}
          >
            Connect
          </Button>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
        <StatusDot connection={connection} />
        <span className="truncate">
          {statusText(connection)}
          <span className="sr-only"> · {agent.scope.paths.join(", ")}</span>
        </span>
      </span>
      <AnimatePresence initial={false}>
        {pickerOpen && (
          <RowReveal key="picker">
            <div
              role="group"
              aria-label={`Connect ${agent.name} with`}
              className="mt-2 flex flex-col gap-0.5 rounded-lg bg-paper p-1"
            >
              <span className="px-2 pt-1 pb-0.5 text-[11.5px] text-ink-muted">
                Configured agents
              </span>
              {harnesses.map((harness) => (
                <button
                  key={harness.id}
                  type="button"
                  onClick={() => void connect(agent.id, harness.id)}
                  className="rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[12.5px] text-ink transition-colors duration-120 hover:bg-raised motion-reduce:transition-none"
                >
                  {harness.label}
                </button>
              ))}
            </div>
          </RowReveal>
        )}
        {warning && (
          <RowReveal key="warning">
            <div
              role="alert"
              className="mt-2 flex flex-col gap-2 rounded-lg bg-req-tint px-2.5 py-2 text-[12px] leading-[17px] text-req-ink"
            >
              <span className="flex gap-1.5">
                <TriangleAlertIcon
                  aria-hidden="true"
                  className="mt-px size-3.5 shrink-0"
                />
                {agent.short} loses its working context. Thread history stays.
              </span>
              <span className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="quiet"
                  size="xs"
                  className="h-7 px-2.5 text-xs font-normal text-req-ink hover:bg-req-tint-2 hover:text-req-ink"
                  onClick={() => setConfirming(null)}
                >
                  Keep connected
                </Button>
                <Button
                  type="button"
                  variant="ink"
                  size="xs"
                  className="h-7 px-2.5 text-xs font-normal"
                  onClick={() => void disconnect(agent.id)}
                >
                  Disconnect
                </Button>
              </span>
            </div>
          </RowReveal>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Header Agents control: the agents on this branch side by side (never
 * overlapped), "+N" past three, and "N agents · M live". The popover groups
 * them as Implementers and Reviewers with scope, unit count, status and
 * Connect / Disconnect.
 */
export function AgentsControl() {
  const registry = useAtomValue(agentRegistryAtom)
  const connections = useAtomValue(agentConnectionsAtom)
  const live = useAtomValue(liveCountAtom)
  const open = useAtomValue(agentsOpenAtom)
  const setOpen = useSetAtom(agentsOpenAtom)
  const setPicker = useSetAtom(connectPickerAtom)
  const setConfirming = useSetAtom(confirmDisconnectAtom)
  const reduce = useReducedMotion()
  const { agents } = registry
  if (agents.length === 0) return null
  const shown = agents.slice(0, MAX_AVATARS)
  const more = agents.length - shown.length
  const roles = (["implementer", "reviewer"] as const).filter((role) =>
    agents.some((agent) => agent.role === role)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setPicker(null)
          setConfirming(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${agents.length} agents on this branch, ${live} connected`}
          className={cn(
            "inline-flex h-[34px] items-center gap-2 rounded-[9px] border-0 bg-transparent pr-2.5 pl-1.5 text-[12.5px] text-ink-2 transition-colors duration-120 hover:bg-raised motion-reduce:transition-none",
            open && "bg-raised"
          )}
        >
          <span className="inline-flex gap-[5px]" aria-hidden="true">
            {shown.map((agent) => (
              <AgentAvatar
                key={agent.id}
                agent={agent}
                connection={connectionOf(connections, agent.id)}
              />
            ))}
            {more > 0 && (
              <span className="inline-flex size-6 items-center justify-center rounded-[7px] bg-raised-2 font-mono text-[9.5px] text-ink-2">
                +{more}
              </span>
            )}
          </span>
          {agents.length} agents · {live} live
        </button>
      </PopoverTrigger>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content
              forceMount
              asChild
              align="end"
              sideOffset={6}
              aria-label="Agents on this branch"
            >
              <motion.div
                initial={
                  reduce
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: POPOVER.offsetY,
                        scale: POPOVER.initialScale,
                      }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reduce
                    ? { opacity: 0, transition: REDUCED_TRANSITION }
                    : {
                        opacity: 0,
                        y: POPOVER.offsetY,
                        transition: POPOVER.exit,
                      }
                }
                transition={reduce ? REDUCED_TRANSITION : POPOVER.enter}
                style={{ transformOrigin: "top right" }}
                className="z-30 box-border w-[min(380px,calc(100vw-32px))] rounded-xl bg-surface font-sans text-sm text-ink shadow-card outline-none"
              >
                <div className="flex items-baseline gap-2 px-3.5 pt-3 pb-1">
                  <span className="text-[13.5px] font-semibold">
                    Agents on this branch
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    via ACP
                  </span>
                </div>
                {roles.map((role) => (
                  <div key={role} className="flex flex-col">
                    <span className="block px-3.5 pt-2 label-mono text-[10.5px]">
                      {ROLE_LABEL[role]}
                    </span>
                    {agents
                      .filter((agent) => agent.role === role)
                      .map((agent) => (
                        <AgentRow key={agent.id} agent={agent} />
                      ))}
                  </div>
                ))}
                <p className="m-0 mt-1.5 border-t border-line-2 px-3.5 pt-2.5 pb-3 text-xs text-ink-muted">
                  Comments reach the agent working on that unit.
                </p>
              </motion.div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </Popover>
  )
}
