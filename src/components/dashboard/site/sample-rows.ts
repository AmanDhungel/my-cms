"use client"

import {
  editorContent,
  isBlankRow,
  type SiteDraft,
} from "@/components/dashboard/site/site-draft"
import { MOCK_CONTENT } from "@/lib/site-mock"
import { LIST_SLOT_IDS, type ListSlotId } from "@/lib/site-slots"
import type { SiteContent } from "@/models/site"

/**
 * Sample rows in the editor's lists.
 *
 * An empty list starts out showing the sample rows, as a scaffold: edit the
 * ones that fit, dismiss the rest. Editing a sample turns only that row into
 * real content; the others stay samples until they too are edited or
 * dismissed.
 *
 * Samples never enter the draft. The editor keeps a "layout" beside it: for
 * each list, its rows in the order they are drawn, each either "real" (the
 * next row of the draft, in order) or the index of a sample. So the draft —
 * which is all that is ever checked, saved, previewed or published — holds
 * only real rows, in the order they sit in the list, and samples can't count
 * towards a list's limit.
 */

export type Entry = "real" | number
export type SampleLayout = Record<ListSlotId, Entry[]>

/**
 * Where a layout starts: an empty list shows every sample, a list with rows
 * shows just its rows. After a save the editor carries its layout over
 * instead (see `layoutFits`), so untouched samples outlive the save.
 */
export function initialLayout(draft: SiteDraft): SampleLayout {
  const out = {} as SampleLayout
  for (const list of LIST_SLOT_IDS) {
    const rows = draft[list] as unknown[]
    out[list] =
      rows.length > 0
        ? rows.map(() => "real" as const)
        : MOCK_CONTENT[list].map((_, index) => index)
  }
  return out
}

/** Whether a layout still describes this draft, row for row. */
export function layoutFits(layout: SampleLayout, draft: SiteDraft) {
  return LIST_SLOT_IDS.every(
    (list) => realCount(layout[list] ?? []) === (draft[list] as unknown[]).length
  )
}

export function realCount(entries: readonly Entry[]) {
  return entries.filter((entry) => entry === "real").length
}

/** The draft index of the real row drawn at `j`, or -1 for a sample. */
export function realIndexAt(entries: readonly Entry[], j: number) {
  if (entries[j] !== "real") return -1
  return realCount(entries.slice(0, j))
}

/** Where a sample at `j` goes in the draft once it becomes real. */
export function insertIndexAt(entries: readonly Entry[], j: number) {
  return realCount(entries.slice(0, j))
}

/** A sample row as the editor draws it: sample words, no picture. */
function sampleRow(list: ListSlotId, index: number) {
  const row = MOCK_CONTENT[list][index] as Record<string, unknown>
  if (list === "products") return { ...row, image: null }
  if (list === "gallery") return { ...row, url: "" }
  return { ...row }
}

/** A sample row as far as "what is saved" goes: nothing. */
function unsavedRow(list: ListSlotId) {
  switch (list) {
    case "services":
      return { title: "", body: null }
    case "products":
      return { name: "", blurb: null, price: null, image: null }
    case "gallery":
      return { url: "", caption: null }
    case "faq":
      return { question: "", answer: "" }
  }
}

/**
 * The two contents the editor's renderer needs: `view`, what is drawn —
 * real rows and samples interleaved as the layout says — and `saved`, the
 * same shape with every sample row empty, which is how a slot tells sample
 * words (faded, never saved) from the owner's own.
 */
export function editorViews(
  draft: SiteDraft,
  layout: SampleLayout
): { view: SiteContent; saved: SiteContent } {
  const base = editorContent(draft)
  const view = { ...base } as Record<string, unknown>
  const saved = { ...base } as Record<string, unknown>
  for (const list of LIST_SLOT_IDS) {
    const rows = base[list] as unknown[]
    let real = 0
    let kept = 0
    view[list] = layout[list].map((entry) =>
      entry === "real" ? rows[real++] : sampleRow(list, entry)
    )
    saved[list] = layout[list].map((entry) =>
      entry === "real" ? rows[kept++] : unsavedRow(list)
    )
  }
  return { view: view as SiteContent, saved: saved as SiteContent }
}

/**
 * The draft with its untouched blank rows dropped, and the layout kept in
 * step: a dropped real row's entry goes with it, samples stay where they
 * are.
 */
export function pruneWithLayout(
  draft: SiteDraft,
  layout: SampleLayout
): { draft: SiteDraft; layout: SampleLayout } {
  const nextDraft = { ...draft } as Record<string, unknown>
  const nextLayout = { ...layout }
  for (const list of LIST_SLOT_IDS) {
    const rows = draft[list] as Record<string, unknown>[]
    const keep = rows.map((row) => !isBlankRow(list, row))
    nextDraft[list] = rows.filter((_, index) => keep[index])
    let real = 0
    nextLayout[list] = layout[list].filter((entry) =>
      entry === "real" ? keep[real++] : true
    )
  }
  return { draft: nextDraft as SiteDraft, layout: nextLayout }
}
