"use client"

import * as React from "react"

/**
 * Whether an element has come near the viewport — and, once it has, true for
 * good. For deferring something expensive until it is about to be seen,
 * without undoing it again when it scrolls away.
 *
 * Where IntersectionObserver is missing it answers true straight away, so
 * the content is never withheld for want of a browser feature.
 */
export function useInView<T extends Element>(rootMargin = "200px") {
  const ref = React.useRef<T | null>(null)
  const [seen, setSeen] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node || seen) return
    if (typeof IntersectionObserver === "undefined") {
      // Deferred to a frame so the state change is not synchronous in the
      // effect; the result is the same.
      const frame = requestAnimationFrame(() => setSeen(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, seen])

  return [ref, seen] as const
}
