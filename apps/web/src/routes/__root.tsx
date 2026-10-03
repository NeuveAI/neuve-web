import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import appCss from "@workspace/ui/globals.css?url"
import { NeuveLinkProvider } from "@workspace/ui/neuve/shared/nav-link"
import { THEME_INIT_SCRIPT } from "@workspace/ui/neuve/shared/theme"

import { RouterLink } from "@/components/router-link"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "Neuve" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
    // Render-blocking: applies a pinned dark theme before first paint.
    scripts: [{ children: THEME_INIT_SCRIPT }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function NotFound() {
  return (
    <main className="flex min-h-svh flex-col gap-2 bg-paper p-16 font-sans text-ink">
      <h1 className="m-0 text-2xl font-semibold">Not found</h1>
      <p className="m-0 text-ink-muted">
        There is no review unit or page at this address.
      </p>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The theme class is set by THEME_INIT_SCRIPT before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <NeuveLinkProvider component={RouterLink}>{children}</NeuveLinkProvider>
        <Scripts />
      </body>
    </html>
  )
}
