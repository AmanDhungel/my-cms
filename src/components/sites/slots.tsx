"use client"

import * as React from "react"
import { cn } from "cn"

import {
  useExtraSlots,
  useRawContent,
  useSiteMode,
  useSlotRenderer,
} from "@/components/sites/site-mode"
import { getPath } from "@/lib/site-slots"

/**
 * The slots every layout draws its content through.
 *
 * A slot is one piece of the site with a stable id — its path in the
 * content. Outside the editor it is just its text or its picture. Inside the
 * editor it hands itself to whatever SlotRenderer the editor provides, and
 * becomes editable in place — the layouts never know the difference, which
 * is what keeps the editor, the preview and the live site drawing from the
 * very same components.
 */

/** The saved value at a path, telling a real value from a sample one. */
function useSavedText(id: string): string | null {
  const raw = useRawContent()
  const value = raw ? getPath(raw, id) : undefined
  return typeof value === "string" && value !== "" ? value : null
}

/**
 * A line or block of text.
 *
 * `value` is what the view shows — already a sample in the editor and a
 * thumbnail. `fallback` is what publishes when nothing was typed: the
 * business name for a headline, the template's wording for a heading. It is
 * real copy, so the editor shows it as it will publish, not faded like a
 * sample. With nothing to show at all, the slot is not drawn.
 */
export function Text({
  id,
  value,
  fallback,
  multiline = false,
  className,
}: {
  id: string
  value: string | null | undefined
  fallback?: string | null
  multiline?: boolean
  className?: string
}) {
  const mode = useSiteMode()
  const renderer = useSlotRenderer()
  const saved = useSavedText(id)
  const shown = value || fallback || null

  if (mode === "editor" && renderer) {
    return (
      <>
        {renderer.text({
          id,
          value: saved,
          display: shown ?? "",
          // A sample is a view value nobody saved; a fallback is not one.
          sample: saved === null && Boolean(value),
          multiline,
          className,
        })}
      </>
    )
  }

  if (!shown) return null
  return (
    <span data-slot={id} className={className}>
      {shown}
    </span>
  )
}

/**
 * Paragraphs, split on blank lines so a typed body keeps its shape. In the
 * editor it is one multi-line field — splitting it into separate editable
 * paragraphs would make a new paragraph impossible to type.
 */
export function ProseText({
  id,
  value,
  className,
}: {
  id: string
  value: string | null | undefined
  className?: string
}) {
  const mode = useSiteMode()
  const renderer = useSlotRenderer()
  const saved = useSavedText(id)

  if (mode === "editor" && renderer) {
    return (
      <div className={cn("text-[15.5px] leading-[1.72]", className)}>
        {renderer.text({
          id,
          value: saved,
          display: value ?? "",
          sample: saved === null,
          multiline: true,
        })}
      </div>
    )
  }

  if (!value) return null
  const paragraphs = value.split(/\n\s*\n/).filter(Boolean)

  return (
    <div data-slot={id} className={cn("flex flex-col gap-3.5", className)}>
      {paragraphs.map((para, index) => (
        <p
          key={index}
          className="m-0 text-[15.5px] leading-[1.72] whitespace-pre-line"
        >
          {para}
        </p>
      ))}
    </div>
  )
}

/**
 * Template wording — a section's heading — that the owner may reword.
 *
 * Kept in the site's `extraSlots` map rather than in the content, because it
 * belongs to the template: the default is the template's own copy, which is
 * real wording rather than a sample, so it is safe to publish untouched.
 */
export function Extra({
  id,
  fallback,
  className,
}: {
  id: string
  fallback: string
  className?: string
}) {
  const mode = useSiteMode()
  const renderer = useSlotRenderer()
  const extras = useExtraSlots()
  const saved = extras[id]?.trim() ? extras[id] : null

  if (mode === "editor" && renderer) {
    return (
      <>
        {renderer.text({
          id,
          value: saved,
          display: saved ?? fallback,
          sample: false,
          multiline: false,
          className,
        })}
      </>
    )
  }

  return (
    <span data-slot={id} className={className}>
      {saved ?? fallback}
    </span>
  )
}

/**
 * A list's items. In the editor the renderer wraps them with the controls to
 * add and remove rows; everywhere else they are just drawn.
 */
export function Items({
  id,
  children,
  className,
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  const mode = useSiteMode()
  const renderer = useSlotRenderer()
  const raw = useRawContent()
  // How many real rows are saved — zero while the samples are standing in.
  const saved = raw ? getPath(raw, id) : undefined
  const count = Array.isArray(saved) ? saved.length : 0

  if (mode === "editor" && renderer) {
    const rows = React.Children.toArray(children).map((child, index) => (
      <React.Fragment key={index}>
        {renderer.item({ listId: id, index, sampled: count === 0, children: child })}
      </React.Fragment>
    ))
    return <>{renderer.list({ id, count, children: rows, className })}</>
  }
  return <>{children}</>
}
