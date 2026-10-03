import * as React from "react"

/**
 * Router-agnostic navigation for UI-package screens.
 *
 * Screens describe *where* a link goes; the host decides *how* to get there.
 * The app injects a TanStack Router `Link` adapter; Storybook uses the plain
 * anchor fallback below.
 */
export type NeuveDestination =
  { to: "overview" } | { to: "unit"; unitId: string }

export type NeuveLinkProps = Omit<
  React.ComponentPropsWithoutRef<"a">,
  "href"
> & {
  destination: NeuveDestination
}

export type NeuveLinkComponent = React.ComponentType<NeuveLinkProps>

export function destinationHref(destination: NeuveDestination) {
  return destination.to === "overview" ? "/" : `/review/${destination.unitId}`
}

function AnchorLink({ destination, ...props }: NeuveLinkProps) {
  return <a href={destinationHref(destination)} {...props} />
}

const NeuveLinkContext = React.createContext<NeuveLinkComponent>(AnchorLink)

export function NeuveLinkProvider({
  component,
  children,
}: {
  component: NeuveLinkComponent
  children: React.ReactNode
}) {
  return (
    <NeuveLinkContext.Provider value={component}>
      {children}
    </NeuveLinkContext.Provider>
  )
}

export function NeuveLink(props: NeuveLinkProps) {
  const Link = React.useContext(NeuveLinkContext)
  return <Link {...props} />
}
