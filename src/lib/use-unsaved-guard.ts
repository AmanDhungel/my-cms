"use client"

import * as React from "react"

const PROMPT = "You have unsaved changes. Leave without saving?"

/**
 * Warn before unsaved work is thrown away.
 *
 * Two ways out of a page need covering. Closing the tab or reloading is the
 * browser's own `beforeunload`, which only lets us ask for its generic
 * prompt. Clicking a link inside the app never reaches `beforeunload` at all
 * — the App Router swaps the page without unloading it — so internal links
 * are caught in the capture phase, before the router's own handler, and
 * asked about directly.
 *
 * Only plain left-clicks on same-origin links are intercepted: a click that
 * opens a new tab leaves this page exactly as it is, and asking about it
 * would be asking about nothing.
 */
export function useUnsavedGuard(dirty: boolean, message = PROMPT) {
  React.useEffect(() => {
    if (!dirty) return

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      // Older browsers still read the return value; modern ones ignore it
      // and show their own wording.
      event.returnValue = ""
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const anchor = (event.target as Element | null)?.closest?.("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // A jump within the same page leaves the form where it is.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return
      }

      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty, message])
}

/**
 * Revoke a set of object URLs when the component using them goes away.
 *
 * A picked picture's preview is a blob held in memory until it is let go
 * of; a form that unmounts without saving would otherwise keep every one it
 * ever showed. The ref is read at unmount, so it always sees the latest
 * drafts rather than the ones from the first render.
 */
export function useRevokeOnUnmount(
  current: () => (string | null | undefined)[]
) {
  const latest = React.useRef(current)
  React.useEffect(() => {
    latest.current = current
  })
  React.useEffect(
    () => () => {
      for (const url of latest.current()) {
        if (url && url.startsWith("blob:")) URL.revokeObjectURL(url)
      }
    },
    []
  )
}
