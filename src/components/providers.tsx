"use client"

import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"

import { getQueryClient } from "@/lib/query-client"
import { tenantFromHost } from "@/lib/tenancy"
import { Toaster } from "@/components/ui/sonner"

/**
 * Whether this page is a tenant's public site (e.g. balaju.localhost).
 * Worked out once, in the browser; on the server it is false. It only
 * decides whether the session provider mounts, which renders no markup.
 */
const ON_TENANT_SITE =
  typeof window !== "undefined" && tenantFromHost(window.location.host) !== null

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <SessionScope>
      <QueryClientProvider client={queryClient}>
        {/*
          The EMS style guide is light-only, so the theme is pinned rather than
          following the OS. `next-themes` stays in place because the sonner
          Toaster reads `useTheme()`.
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        {process.env.NODE_ENV === "development" ? (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        ) : null}
      </QueryClientProvider>
    </SessionScope>
  )
}

/**
 * The Auth.js session, everywhere but a tenant's public site.
 *
 * A public site has no sign-in, and its host answers 404 for the auth routes
 * (see api/auth). Auth.js's provider asks for the session as soon as it
 * mounts — even when told there is none, a development re-mount asks again
 * — so on a public site it isn't mounted at all, and the page makes no auth
 * requests that could only fail. It renders no markup of its own, so the
 * page's HTML is the same either way.
 */
function SessionScope({ children }: { children: React.ReactNode }) {
  if (ON_TENANT_SITE) return <>{children}</>
  return <SessionProvider>{children}</SessionProvider>
}
