"use client"

import * as React from "react"

import type { SiteContent } from "@/models/site"

/**
 * Where a site is being drawn, which decides what an empty slot looks like.
 *
 * The same ten layouts render in four places, and the difference between
 * them is entirely about absence:
 *
 * - "editor": the owner is filling it in. Every slot is visible and
 *   clickable; empty text shows sample copy and an empty picture shows an
 *   "Add image" box, so there is always something to click on.
 * - "preview": exactly what a visitor would get. Nothing sample, nothing
 *   clickable.
 * - "published": the live subdomain. Same rules as preview.
 * - "thumbnail": a template card in the gallery. Sample copy and the sample
 *   pictures, fifty times on one page, with nothing live inside — no ids, no
 *   links, no sticky header.
 *
 * This union is the one definition. The editor imports it; nothing redefines
 * it.
 */
export type SiteMode = "editor" | "preview" | "published" | "thumbnail"

export const SiteModeContext = React.createContext<SiteMode>("published")

export function useSiteMode() {
  return React.useContext(SiteModeContext)
}

/** Whether empty slots are filled with sample content in this mode. */
export function showsSamples(mode: SiteMode) {
  return mode === "editor" || mode === "thumbnail"
}

/**
 * Whether links behave as links. In the editor a click means "edit this",
 * and in a thumbnail it means "pick this template", so neither may navigate.
 */
export function linksAreLive(mode: SiteMode) {
  return mode === "preview" || mode === "published"
}

/**
 * The content as saved, before any sample text was filled in.
 *
 * Layouts draw from a view that may be padded with samples; a slot looks here
 * to tell a real value from a sample one, which is what lets the editor start
 * a click on sample text from an empty field rather than saving the sample.
 */
export const RawContentContext = React.createContext<SiteContent | null>(null)

export function useRawContent() {
  return React.useContext(RawContentContext)
}

/** Template-only text — section headings — keyed by slot id. */
export const ExtraSlotsContext = React.createContext<Record<string, string>>(
  {}
)

export function useExtraSlots() {
  return React.useContext(ExtraSlotsContext)
}

// ---- the editor seam --------------------------------------------------------

export type TextSlotRenderProps = {
  id: string
  /** What is saved, or null when the slot is still showing its sample. */
  value: string | null
  /** What the page is showing now: the value, a profile fallback or a sample. */
  display: string
  multiline: boolean
  className?: string
}

export type ImageSlotRenderProps = {
  id: string
  value: string | null
  alt: string
  ratio: string
  className?: string
}

export type ListSlotRenderProps = {
  id: string
  /** How many real items are saved; zero while samples are shown. */
  count: number
  children: React.ReactNode
  className?: string
}

/**
 * How the editor draws a slot. The layouts never know an editor exists: they
 * render slots, and a slot asks this context — which only the editor
 * provides — whether to become editable.
 */
export type SlotRenderer = {
  text: (props: TextSlotRenderProps) => React.ReactNode
  image: (props: ImageSlotRenderProps) => React.ReactNode
  list: (props: ListSlotRenderProps) => React.ReactNode
}

export const SlotRendererContext = React.createContext<SlotRenderer | null>(
  null
)

export function useSlotRenderer() {
  return React.useContext(SlotRendererContext)
}
