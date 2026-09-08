"use client"

import * as React from "react"

/**
 * One rAF-throttled scroll handler drives every scroll-linked effect on the
 * page, exactly as the design does. Elements opt in with data attributes:
 *
 *   [data-reveal]                 fade + rise once it enters the viewport
 *   [data-delay="120"]            stagger, in ms
 *   [data-para="0.10"]            parallax, as a fraction of distance travelled
 *   [data-fill] in [data-fill-scope]  progress line that fills across a section
 */
export function ScrollEffects() {
  React.useEffect(() => {
    const root = document.documentElement
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    root.classList.add("reveal-ready")

    const progress = document.querySelector<HTMLElement>("[data-scroll-progress]")
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    )
    const parallax = Array.from(
      document.querySelectorAll<HTMLElement>("[data-para]")
    )
    const fills = Array.from(document.querySelectorAll<HTMLElement>("[data-fill]"))

    for (const el of reveals) {
      el.style.transitionDelay = `${el.dataset.delay ?? 0}ms`
    }

    let queued = false

    const update = () => {
      queued = false
      const vh = window.innerHeight
      const max = root.scrollHeight - vh

      if (progress) {
        const t = max > 0 ? window.scrollY / max : 0
        progress.style.width = `${(t * 100).toFixed(2)}%`
      }

      for (const el of reveals) {
        if (el.dataset.revealed) continue
        const rect = el.getBoundingClientRect()
        if (rect.top < vh * 0.86 && rect.bottom > 0) {
          el.dataset.revealed = "true"
        }
      }

      if (!reduceMotion) {
        for (const el of parallax) {
          const rect = el.getBoundingClientRect()
          const speed = Number(el.dataset.para) || 0.1
          const offset = -(rect.top - vh / 2) * speed
          el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
        }
      }

      for (const el of fills) {
        const scope = el.closest<HTMLElement>("[data-fill-scope]")
        if (!scope) continue
        const rect = scope.getBoundingClientRect()
        const p = Math.max(
          0,
          Math.min(1, (vh * 0.75 - rect.top) / (rect.height * 0.65))
        )
        el.style.transform = `scaleX(${p.toFixed(3)})`
      }
    }

    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      root.classList.remove("reveal-ready")
    }
  }, [])

  return null
}
