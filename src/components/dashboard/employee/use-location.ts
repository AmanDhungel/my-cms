"use client"

import * as React from "react"

import { LocationError, getCurrentFix, type Fix } from "@/lib/geolocation"

type State = { fix: Fix | null; error: string | null; locating: boolean }

/**
 * Asks the device for one position fix, and again on `retry`. Every state
 * change happens in a promise callback rather than in the effect body, so
 * React isn't pushed through a cascading render on mount.
 */
export function useLocationFix() {
  const [attempt, setAttempt] = React.useState(0)
  const [state, setState] = React.useState<State>({
    fix: null,
    error: null,
    locating: true,
  })

  React.useEffect(() => {
    let cancelled = false

    getCurrentFix().then(
      (fix) => {
        if (!cancelled) setState({ fix, error: null, locating: false })
      },
      (error: unknown) => {
        if (cancelled) return
        setState({
          fix: null,
          error:
            error instanceof LocationError
              ? error.message
              : "Could not read your location.",
          locating: false,
        })
      }
    )

    // A dialog closed mid-lookup must not write into an unmounted tree.
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = React.useCallback(() => {
    setState((prev) => ({ ...prev, error: null, locating: true }))
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, retry }
}
