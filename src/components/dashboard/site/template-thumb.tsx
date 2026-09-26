"use client"

import * as React from "react"

import { SiteRenderer } from "@/components/sites/site-renderer"
import { MOCK_CONTENT } from "@/lib/site-mock"
import type { Template } from "@/lib/site-templates"
import { useInView } from "@/lib/use-in-view"

/** The width the page is laid out at before it is scaled down to the card. */
const FRAME_WIDTH = 1200

/**
 * A template card's picture: the real page, drawn at desktop width and
 * scaled down to fit.
 *
 * It is the very same renderer the live site uses, in "thumbnail" mode —
 * sample words and sample pictures, nothing clickable or focusable — so what
 * the card shows is what the template is, not a drawing of it. The top of
 * the page is what fits; the rest is cut off by the card.
 *
 * Fifty full pages are a lot to draw, so each one waits until its card is
 * near the screen, and shows a plain block in the theme's colours until then.
 */
export function TemplateThumb({ template }: { template: Template }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const [scale, setScale] = React.useState(0)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setScale(node.clientWidth / FRAME_WIDTH)
    if (typeof ResizeObserver === "undefined") {
      const frame = requestAnimationFrame(measure)
      return () => cancelAnimationFrame(frame)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return (
    <div
      ref={ref}
      data-template-thumb={template.id}
      data-thumb-ready={seen && scale > 0 ? "" : undefined}
      style={template.theme.vars as React.CSSProperties}
      className="relative aspect-[16/10] w-full overflow-hidden rounded-[9px] border border-[var(--site-border)] bg-[var(--site-bg)]"
    >
      {seen && scale > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{ width: FRAME_WIDTH, transform: `scale(${scale})` }}
        >
          <SiteRenderer
            template={template.id}
            content={MOCK_CONTENT}
            mode="thumbnail"
          />
        </div>
      ) : null}
    </div>
  )
}
