import { Link } from "@tanstack/react-router"

import type { NeuveLinkProps } from "@workspace/ui/neuve/shared/nav-link"

/** Adapts UI-package destinations onto typed TanStack Router links. */
export function RouterLink({ destination, ...props }: NeuveLinkProps) {
  if (destination.to === "overview") return <Link to="/" {...props} />
  return (
    <Link
      to="/review/$unitId"
      params={{ unitId: destination.unitId }}
      {...props}
    />
  )
}
