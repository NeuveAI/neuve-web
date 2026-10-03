import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import type {
  AgentConnection,
  AgentRole,
  BranchAgent,
} from "@workspace/ui/neuve/types"

/**
 * An agent's avatar: shadcn/ui Avatar as a rounded square (agents are
 * squares, people are speech bubbles), its initials in mono, and a status
 * badge. Role carries the tint while connected: implementers ocean-green,
 * reviewers golden-grass; anything not connected is muted.
 */
const ROLE_TINT: Record<AgentRole, string> = {
  implementer: "bg-agt-tint text-agt-fg",
  reviewer: "bg-sug-tint text-sug-ink",
}

const STATUS_DOT: Record<AgentConnection["status"], string> = {
  connected: "bg-agt",
  connecting: "bg-brand",
  disconnected: "bg-faint",
}

export function AgentAvatar({
  agent,
  connection,
  size = "sm",
  badge = true,
  className,
}: {
  agent: Pick<BranchAgent, "short" | "role" | "name">
  connection?: AgentConnection
  /** sm = 24px (header stack), default = 28px (popover rows). */
  size?: "sm" | "default"
  badge?: boolean
  className?: string
}) {
  const status = connection?.status ?? "connected"
  return (
    <Avatar
      size={size}
      className={cn(
        "rounded-[7px] after:rounded-[7px] after:border-0",
        size === "sm" ? "size-6" : "size-7",
        className
      )}
    >
      <AvatarFallback
        className={cn(
          "rounded-[7px] font-mono font-semibold",
          size === "sm" ? "text-[9.5px]" : "text-[10px]",
          status === "connected"
            ? ROLE_TINT[agent.role]
            : "bg-raised text-faint"
        )}
      >
        {agent.short}
      </AvatarFallback>
      {badge && (
        <AvatarBadge
          aria-hidden="true"
          className={cn(
            "-right-0.5 -bottom-0.5 size-2 ring-paper group-data-[size=default]/avatar:size-2 group-data-[size=sm]/avatar:size-2",
            STATUS_DOT[status]
          )}
        />
      )}
    </Avatar>
  )
}

/** The small mono agent tag on rail units and judgment rows (I1, I2). */
export function AgentTag({
  agent,
  className,
}: {
  agent: Pick<BranchAgent, "short" | "name" | "scope">
  className?: string
}) {
  return (
    <span
      title={`${agent.name} · ${agent.scope.label}`}
      className={cn(
        "rounded-sm bg-agt-tint px-[5px] py-px font-mono text-[10px] font-medium text-agt-fg",
        className
      )}
    >
      {agent.short}
    </span>
  )
}
