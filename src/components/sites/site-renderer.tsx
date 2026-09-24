import { LAYOUT_COMPONENTS } from "@/components/sites/layouts"
import { templateById } from "@/lib/site-templates"
import type { SiteContent } from "@/models/site"

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
 */
export function SiteRenderer({
  template,
  content,
  className,
}: {
  template: string
  content: SiteContent
  className?: string
}) {
  const { layout, theme } = templateById(template)
  const Layout = LAYOUT_COMPONENTS[layout.id] ?? LAYOUT_COMPONENTS.spotlight

  return (
    <div
      style={theme.vars as React.CSSProperties}
      data-template={template}
      className={`isolate bg-[var(--site-bg)] font-[family-name:var(--site-body)] text-[var(--site-fg)] ${className ?? ""}`}
    >
      <Layout content={content} sections={layout.sections} />
    </div>
  )
}
