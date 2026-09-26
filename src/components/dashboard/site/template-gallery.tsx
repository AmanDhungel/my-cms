"use client"

import * as React from "react"
import { cn } from "cn"

import { TemplateThumb } from "@/components/dashboard/site/template-thumb"
import {
  LAYOUTS,
  TEMPLATES,
  THEMES,
  type Layout,
  type SectionKey,
} from "@/lib/site-templates"

/**
 * The fifty.
 *
 * Each card shows the real page — the same renderer the live site uses,
 * dressed in sample content and scaled down — so what the owner picks is
 * what they get. Cards draw themselves only as they near the screen, so
 * fifty of them cost no more up front than the few in view.
 */
export function TemplateGallery({
  value,
  onPick,
}: {
  value: string
  onPick: (id: string) => void
}) {
  const [layout, setLayout] = React.useState<string>("all")
  const [theme, setTheme] = React.useState<string>("all")

  const shown = TEMPLATES.filter(
    (one) =>
      (layout === "all" || one.layout.id === layout) &&
      (theme === "all" || one.theme.id === theme)
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <Row label="Shape">
          <Chip
            label="All shapes"
            active={layout === "all"}
            onClick={() => setLayout("all")}
          />
          {LAYOUTS.map((one) => (
            <Chip
              key={one.id}
              label={one.name}
              active={layout === one.id}
              onClick={() => setLayout(one.id)}
            />
          ))}
        </Row>

        <Row label="Finish">
          <Chip
            label="All finishes"
            active={theme === "all"}
            onClick={() => setTheme("all")}
          />
          {THEMES.map((one) => (
            <Chip
              key={one.id}
              label={one.name}
              active={theme === one.id}
              onClick={() => setTheme(one.id)}
              swatch={one.swatch}
            />
          ))}
        </Row>
      </div>

      <span className="text-n-500 font-mono text-[11px] tracking-[0.06em]">
        {shown.length} OF {TEMPLATES.length} TEMPLATES
      </span>

      <div
        data-template-gallery
        className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {shown.map((template) => {
          const chosen = template.id === value

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template.id)}
              aria-pressed={chosen}
              data-template-card={template.id}
              className={cn(
                "flex flex-col gap-3 rounded-[14px] border p-3 text-left transition-colors",
                chosen
                  ? "border-p-400 bg-p-100/40 ring-p-400 ring-1"
                  : "border-n-200 hover:border-n-300 bg-white"
              )}
            >
              <TemplateThumb template={template} />

              <div className="flex flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold">
                    {template.name}
                  </span>
                  {chosen ? (
                    <span className="text-p-700 font-mono text-[10px] tracking-[0.06em]">
                      IN USE
                    </span>
                  ) : null}
                </span>
                <span className="text-n-500 text-[12px] leading-snug">
                  {template.layout.blurb}
                </span>
                <span className="text-n-400 text-[11.5px] leading-snug">
                  {template.layout.suits}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The little diagram — what the cards drew before they showed the real page.
 * Kept for anywhere a page is too small to draw legibly.
 *
 * One band per section in the order the layout draws them, shaped roughly the
 * way that section looks: a hero is tall, a product grid is a row of squares,
 * a text section is a stack of lines.
 */
export function Wireframe({
  layout,
  vars,
}: {
  layout: Layout
  vars: Record<string, string>
}) {
  return (
    <div
      style={vars as React.CSSProperties}
      className="flex h-[128px] flex-col gap-1.5 overflow-hidden rounded-[9px] border border-[var(--site-border)] bg-[var(--site-bg)] p-2.5"
    >
      {layout.sections.slice(0, 5).map((section, index) => (
        <Band key={`${section}-${index}`} section={section} first={index === 0} />
      ))}
    </div>
  )
}

function Band({ section, first }: { section: SectionKey; first: boolean }) {
  const bar = "rounded-[2px] bg-[var(--site-fg)] opacity-[0.72]"
  const soft = "rounded-[2px] bg-[var(--site-muted)] opacity-40"
  const tile = "rounded-[2px] bg-[var(--site-muted)] opacity-25"

  if (section === "hero") {
    return (
      <div className="flex shrink-0 flex-col gap-1">
        <div className={cn(bar, "h-2 w-3/5")} />
        <div className={cn(soft, "h-1.5 w-2/5")} />
        {first ? (
          <div className="mt-0.5 h-2 w-12 rounded-[2px] bg-[var(--site-accent)]" />
        ) : null}
      </div>
    )
  }

  if (section === "products" || section === "gallery") {
    return (
      <div className="grid shrink-0 grid-cols-4 gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={cn(tile, "h-5")} />
        ))}
      </div>
    )
  }

  if (section === "services") {
    return (
      <div className="grid shrink-0 grid-cols-3 gap-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className={cn(bar, "h-1 w-full")} />
            <div className={cn(soft, "h-1 w-2/3")} />
          </div>
        ))}
      </div>
    )
  }

  if (section === "contact") {
    return (
      <div className="mt-auto flex shrink-0 gap-1">
        <div className={cn(soft, "h-1.5 w-1/4")} />
        <div className={cn(soft, "h-1.5 w-1/4")} />
      </div>
    )
  }

  // about and faq: stacked lines of text
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <div className={cn(bar, "h-1 w-1/3")} />
      <div className={cn(soft, "h-1 w-full")} />
      <div className={cn(soft, "h-1 w-4/5")} />
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-n-500 mr-1 font-mono text-[10.5px] tracking-[0.07em]">
        {label.toUpperCase()}
      </span>
      {children}
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
  swatch,
}: {
  label: string
  active: boolean
  onClick: () => void
  swatch?: [string, string, string]
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active
          ? "bg-p-100 border-p-400 text-p-700 font-semibold"
          : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
      )}
    >
      {swatch ? (
        <span className="flex overflow-hidden rounded-full border border-black/10">
          {/*
            Keyed by position, not by colour: a monochrome palette repeats the
            same value, and two children with the same key is a real fault.
          */}
          {swatch.map((colour, index) => (
            <span
              key={index}
              style={{ background: colour }}
              className="size-2"
            />
          ))}
        </span>
      ) : null}
      {label}
    </button>
  )
}
