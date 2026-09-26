"use client"

import * as React from "react"

import { LAYOUT_COMPONENTS } from "@/components/sites/layouts"
import {
  ExtraSlotsContext,
  RawContentContext,
  SiteModeContext,
  showsSamples,
  type SiteMode,
} from "@/components/sites/site-mode"
import { withSamples } from "@/lib/site-slots"
import { templateById } from "@/lib/site-templates"
import type { SiteContent } from "@/models/site"

const NO_EXTRAS: Record<string, string> = {}

/**
 * Draws a site.
 *
 * The theme arrives as inline custom properties on the outer element rather
 * than as a stylesheet, which is what lets the builder's preview show one
 * theme while the dashboard around it keeps its own — two different palettes
 * on one page, with no class names colliding.
 *
 * `isolate` and the explicit background matter for the same reason: inside
 * the preview this sits within the app's own colours, and without them the
 * site would inherit them.
 *
 * `mode` says where it is being drawn (see SiteMode). The default is
 * "published", so any caller that doesn't say gets the strictest behaviour:
 * no samples, nothing editable. In the editor and in thumbnails the layouts
 * are handed the content padded with samples, while the slots can still see
 * what was actually saved.
 */
export function SiteRenderer({
  template,
  content,
  className,
  mode = "published",
  extraSlots,
}: {
  template: string
  content: SiteContent
  className?: string
  mode?: SiteMode
  /** Template-only wording, such as reworded section headings. */
  extraSlots?: Record<string, string>
}) {
  const { layout, theme } = templateById(template)
  const Layout = LAYOUT_COMPONENTS[layout.id] ?? LAYOUT_COMPONENTS.spotlight

  const view = React.useMemo(
    () =>
      showsSamples(mode)
        ? withSamples(content, { pictures: mode === "thumbnail" })
        : content,
    [content, mode]
  )

  const thumbnail = mode === "thumbnail"

  return (
    <SiteModeContext.Provider value={mode}>
      <RawContentContext.Provider value={content}>
        <ExtraSlotsContext.Provider value={extraSlots ?? NO_EXTRAS}>
          <div
            style={theme.vars as React.CSSProperties}
            data-template={template}
            data-site-mode={mode}
            // A thumbnail is a picture of a page, not a page: nothing in it
            // can be focused, read out or clicked.
            inert={thumbnail || undefined}
            aria-hidden={thumbnail || undefined}
            className={`isolate bg-[var(--site-bg)] font-[family-name:var(--site-body)] text-[var(--site-fg)] ${thumbnail ? "pointer-events-none select-none" : ""} ${className ?? ""}`}
          >
            <Layout content={view} sections={layout.sections} />
          </div>
        </ExtraSlotsContext.Provider>
      </RawContentContext.Provider>
    </SiteModeContext.Provider>
  )
}
