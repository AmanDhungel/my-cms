"use client"

import * as React from "react"
import { ImagePlusIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  editorViews,
  insertIndexAt,
  realCount,
  realIndexAt,
  type SampleLayout,
} from "@/components/dashboard/site/sample-rows"
import { blankRow, type SiteDraft } from "@/components/dashboard/site/site-draft"
import { ImagePlaceholder, radius } from "@/components/sites/parts"
import {
  SlotRendererContext,
  type ImageSlotRenderProps,
  type ListItemRenderProps,
  type ListSlotRenderProps,
  type SlotRenderer,
  type TextSlotRenderProps,
} from "@/components/sites/site-mode"
import { SiteRenderer } from "@/components/sites/site-renderer"
import { getPath, setPath, type ListSlotId } from "@/lib/site-slots"
import { LIMITS } from "@/lib/site-templates"
import {
  ACCEPTED_TYPES,
  clearImage,
  prepareImage,
  type ImageDraft,
} from "@/lib/upload-client"

/**
 * The page itself, editable where it stands.
 *
 * This is the same renderer the live site uses, in "editor" mode, with a
 * SlotRenderer that turns each slot into something to click: text becomes
 * editable in place, a picture gets Change and Remove, a list gets Add and ×.
 * The layouts know none of this — they draw slots, and the slots ask here.
 *
 * Text is committed when the field is left (or on Enter), not per keystroke,
 * so nothing re-renders under the caret while someone is typing. Pictures are
 * only prepared here — compressed, previewed from a local object URL — and
 * are uploaded by the page's Save, like everywhere else in the app.
 */

type Setter<T> = React.Dispatch<React.SetStateAction<T>>

const LIST_NOUN: Record<ListSlotId, string> = {
  services: "service",
  products: "product",
  gallery: "picture",
  faq: "question",
}

/** Fields a row cannot be saved without, which are cleared to "" not null. */
const REQUIRED_FIELD = /^(services|products|faq)\.\d+\.(title|name|question|answer)$/

const LIST_ITEM = /^(services|products|gallery|faq)\.(\d+)\.(\w+)$/

/** What a slot is called, for screen readers and error messages. */
export function slotLabel(id: string) {
  const known: Record<string, string> = {
    name: "Business name",
    tagline: "Tagline",
    description: "Description",
    "hero.headline": "Headline",
    "hero.sub": "Supporting line",
    "hero.ctaLabel": "Button text",
    "hero.image": "Main picture",
    "about.title": "About heading",
    "about.body": "About text",
    "about.image": "About picture",
    "contact.phone": "Phone",
    "contact.email": "Email",
    "contact.address": "Address",
    "contact.hours": "Opening hours",
  }
  if (known[id]) return known[id]
  const item = LIST_ITEM.exec(id)
  if (item) {
    return `${LIST_NOUN[item[1] as ListSlotId]} ${Number(item[2]) + 1} ${item[3]}`
  }
  const heading = /^heading\.(\w+)\.(title|eyebrow)$/.exec(id)
  if (heading) return `${heading[1]} section ${heading[2] === "title" ? "heading" : "eyebrow"}`
  return id
}

/**
 * A list slot id, split: "services.3.title" → the list, the row as drawn,
 * and the field.
 */
function listSlot(id: string) {
  const item = LIST_ITEM.exec(id)
  return item
    ? { list: item[1] as ListSlotId, row: Number(item[2]), field: item[3] }
    : null
}

export function InlineEditor({
  template,
  draft,
  extraSlots,
  layout,
  onDraft,
  onExtraSlots,
  onLayout,
  onPreparing,
  uploads,
  errors,
}: {
  template: string
  draft: SiteDraft
  extraSlots: Record<string, string>
  /** Which rows of each list are real and which are samples (sample-rows.ts). */
  layout: SampleLayout
  onDraft: Setter<SiteDraft>
  onExtraSlots: Setter<Record<string, string>>
  onLayout: Setter<SampleLayout>
  /** Told +1 when a picture starts compressing and -1 when it is done. */
  onPreparing?: (delta: 1 | -1) => void
  uploads: boolean
  errors: Record<string, string>
}) {
  // A picture can finish compressing after the editor has gone (the page
  // was left). Its preview then has no one to show it and is let go of.
  const aliveRef = React.useRef(true)
  // The layout as it is by the time a picture has finished compressing,
  // which may not be the layout it was picked under.
  const layoutRef = React.useRef(layout)
  React.useEffect(() => {
    layoutRef.current = layout
  })
  React.useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const renderer = React.useMemo<SlotRenderer>(() => {
    /**
     * Write a value into the slot drawn at `id`. A real row is written in
     * place; a sample becomes a real row holding just this value, inserted
     * where it sits in the list, and the other samples stay samples.
     */
    function write(current: SampleLayout, id: string, value: unknown) {
      const slot = listSlot(id)
      if (!slot) {
        onDraft((prev) => setPath(prev, id, value))
        return
      }
      const entries = current[slot.list]
      const entry = entries[slot.row]
      if (entry === undefined) return
      if (entry === "real") {
        const at = realIndexAt(entries, slot.row)
        onDraft((prev) => {
          const old = getPath(prev, `${slot.list}.${at}.${slot.field}`) as
            | ImageDraft
            | undefined
          // A picture it replaces is let go of here; revoking twice is
          // harmless, so this is safe under a double-invoked updater.
          if (old && typeof old === "object" && old.preview && value !== old) {
            URL.revokeObjectURL(old.preview)
          }
          return setPath(prev, `${slot.list}.${at}.${slot.field}`, value)
        })
        return
      }
      const at = insertIndexAt(entries, slot.row)
      onDraft((prev) => {
        const rows = [...(prev[slot.list] as unknown[])]
        rows.splice(at, 0, { ...blankRow(slot.list), [slot.field]: value })
        return { ...prev, [slot.list]: rows }
      })
      onLayout((prev) => ({
        ...prev,
        [slot.list]: prev[slot.list].map((one, i) =>
          i === slot.row ? ("real" as const) : one
        ),
      }))
    }

    function commitText(id: string, text: string) {
      if (id.startsWith("heading.")) {
        onExtraSlots((prev) => {
          const next = { ...prev }
          if (text) next[id] = text
          else delete next[id]
          return next
        })
        return
      }
      const required = id === "name" || REQUIRED_FIELD.test(id)
      write(layout, id, text === "" ? (required ? "" : null) : text)
    }

    async function pickImage(id: string, file: File) {
      let next: ImageDraft
      onPreparing?.(1)
      try {
        next = await prepareImage(file)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `${file.name} couldn't be read`
        )
        return
      } finally {
        onPreparing?.(-1)
      }
      if (!aliveRef.current) {
        if (next.preview) URL.revokeObjectURL(next.preview)
        return
      }
      write(layoutRef.current, id, next)
    }

    function removeImage(id: string) {
      const slot = listSlot(id)
      const path = slot
        ? `${slot.list}.${realIndexAt(layout[slot.list], slot.row)}.${slot.field}`
        : id
      if (slot && realIndexAt(layout[slot.list], slot.row) < 0) return
      onDraft((prev) => {
        const old = getPath(prev, path) as ImageDraft | undefined
        return old ? setPath(prev, path, clearImage(old)) : prev
      })
    }

    function addRow(list: ListSlotId) {
      onDraft((prev) => ({
        ...prev,
        [list]: [...(prev[list] as unknown[]), blankRow(list)],
      }))
      onLayout((prev) => ({ ...prev, [list]: [...prev[list], "real" as const] }))
    }

    /** × on a row: a real row is removed, a sample is dismissed. */
    function removeRow(list: ListSlotId, row: number) {
      const at = realIndexAt(layout[list], row)
      if (at >= 0) {
        onDraft((prev) => {
          const rows = prev[list] as Record<string, unknown>[]
          for (const value of Object.values(rows[at] ?? {})) {
            const image = value as ImageDraft | null
            if (image && typeof image === "object" && image.preview) {
              URL.revokeObjectURL(image.preview)
            }
          }
          return { ...prev, [list]: rows.filter((_, i) => i !== at) }
        })
      }
      onLayout((prev) => ({
        ...prev,
        [list]: prev[list].filter((_, i) => i !== row),
      }))
    }

    // Errors come back against the draft's rows; the page draws them among
    // samples, so a row's error is found through the layout.
    const errorFor = (id: string) => {
      if (id.startsWith("heading.")) return errors[`extraSlots.${id}`]
      const slot = listSlot(id)
      if (!slot) return errors[`content.${id}`]
      const at = realIndexAt(layout[slot.list], slot.row)
      return at < 0 ? undefined : errors[`content.${slot.list}.${at}.${slot.field}`]
    }

    return {
      text: (props: TextSlotRenderProps) => (
        <EditableText {...props} error={errorFor(props.id)} onCommit={commitText} />
      ),
      image: (props: ImageSlotRenderProps) => (
        <EditableImage
          {...props}
          enabled={uploads}
          onPick={pickImage}
          onRemove={removeImage}
        />
      ),
      list: ({ id, children }: ListSlotRenderProps) => {
        const list = id as ListSlotId
        // Only real rows count towards the limit; samples never do.
        return (
          <>
            {children}
            {realCount(layout[list]) < LIMITS[list] ? (
              <button
                type="button"
                data-add-row={list}
                onClick={() => addRow(list)}
                className={cn(
                  radius,
                  "flex min-h-[96px] items-center justify-center gap-2 border-2 border-dashed border-[var(--site-border)] bg-transparent text-[13px] font-semibold text-[var(--site-muted)] transition-colors hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]"
                )}
              >
                <PlusIcon className="size-4" />
                Add a {LIST_NOUN[list]}
              </button>
            ) : null}
          </>
        )
      },
      item: ({ listId, index, children }: ListItemRenderProps) => {
        const list = listId as ListSlotId
        const sampled = typeof layout[list]?.[index] === "number"
        const noun = LIST_NOUN[list]
        return (
          <div
            data-edit-row={`${listId}.${index}`}
            data-sample-row={sampled ? "" : undefined}
            className="group/row relative grid"
          >
            {children}
            {sampled ? (
              <span
                data-sample-tag
                className="bg-n-800/85 pointer-events-none absolute top-1.5 left-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white uppercase"
              >
                Sample
              </span>
            ) : null}
            <button
              type="button"
              aria-label={
                sampled
                  ? `Dismiss sample ${noun} ${index + 1}`
                  : `Remove ${noun} ${index + 1}`
              }
              onClick={() => removeRow(list, index)}
              className="text-n-700 absolute -top-2.5 -right-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-white opacity-0 shadow-md ring-1 ring-black/10 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:text-red-600 focus-visible:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )
      },
    }
  }, [errors, layout, onDraft, onExtraSlots, onLayout, onPreparing, uploads])

  const { view, saved } = React.useMemo(
    () => editorViews(draft, layout),
    [draft, layout]
  )

  return (
    <SlotRendererContext.Provider value={renderer}>
      <SiteRenderer
        template={template}
        content={view}
        savedContent={saved}
        extraSlots={extraSlots}
        mode="editor"
      />
    </SlotRendererContext.Provider>
  )
}

// ---- text -------------------------------------------------------------------

function normalise(text: string, multiline: boolean) {
  const clean = text.replace(/\r\n?/g, "\n").replace(/ /g, " ")
  return multiline
    ? clean.replace(/[ \t]+\n/g, "\n").trim()
    : clean.replace(/\s*\n\s*/g, " ").trim()
}

/** Put plain text at the caret, replacing whatever is selected. */
function insertAtCaret(text: string) {
  // execCommand keeps the browser's own undo history; the manual path is
  // there for a browser that has finally dropped it.
  if (document.queryCommandSupported?.("insertText")) {
    if (document.execCommand("insertText", false, text)) return
  }
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function EditableText({
  id,
  display,
  sample,
  multiline,
  className,
  error,
  onCommit,
}: TextSlotRenderProps & {
  error?: string
  onCommit: (id: string, text: string) => void
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const editingRef = React.useRef(false)
  const cancelRef = React.useRef(false)
  // Bumped whenever editing ends, so the text is put back from props even
  // when a commit left the displayed value exactly as it was.
  const [revision, setRevision] = React.useState(0)

  // The text is written in by hand rather than rendered as children: React
  // reconciling a text node the browser is editing is how carets jump.
  React.useLayoutEffect(() => {
    const node = ref.current
    if (node && !editingRef.current && node.textContent !== display) {
      node.textContent = display
    }
  }, [display, revision])

  function onFocus() {
    editingRef.current = true
    cancelRef.current = false
    // A sample is there to be replaced, not edited: it is cleared the moment
    // the field is entered, and stays visible only as a placeholder. Done
    // synchronously, so no keystroke can land inside the sample text.
    if (sample && ref.current) ref.current.textContent = ""
  }

  function onBlur() {
    const node = ref.current
    editingRef.current = false
    if (node && !cancelRef.current) {
      const text = normalise(node.textContent ?? "", multiline)
      // Entering a sample and leaving it empty changes nothing — above all,
      // it must not turn a sample list row into a real, empty one.
      const changed = sample ? text !== "" : text !== normalise(display, multiline)
      if (changed) onCommit(id, text)
    }
    cancelRef.current = false
    setRevision((value) => value + 1)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancelRef.current = true
      if (ref.current) ref.current.textContent = display
      ref.current?.blur()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      if (multiline && event.shiftKey) {
        insertAtCaret("\n")
        return
      }
      ref.current?.blur()
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLSpanElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    insertAtCaret(multiline ? text.replace(/\r\n?/g, "\n") : text.replace(/\s*[\r\n]+\s*/g, " "))
  }

  return (
    <span className={cn("group/slot relative", multiline && "block")}>
      <span
        ref={ref}
        role="textbox"
        aria-label={slotLabel(id)}
        aria-multiline={multiline || undefined}
        aria-invalid={Boolean(error) || undefined}
        title={error}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        data-edit-slot={id}
        data-sample={sample ? "" : undefined}
        data-placeholder={sample ? display : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDrop={(event) => event.preventDefault()}
        className={cn(
          "cursor-text rounded-[3px] outline-2 outline-offset-[3px] outline-transparent transition-[outline-color] hover:outline-dashed hover:outline-[color-mix(in_oklab,var(--site-accent)_70%,transparent)] focus:outline-solid focus:outline-[var(--site-accent)]",
          multiline ? "block whitespace-pre-wrap" : "inline-block min-w-[3ch]",
          // Faded, so a sample reads as "not yours yet" at a glance; while
          // it is being typed over, it lingers as a placeholder.
          sample &&
            "opacity-55 empty:before:pointer-events-none empty:before:opacity-50 empty:before:content-[attr(data-placeholder)] focus:opacity-100",
          error && "outline-solid outline-red-500 hover:outline-red-500",
          className
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-2.5 -right-2.5 z-10 hidden size-5 items-center justify-center rounded-full bg-[var(--site-accent)] text-[var(--site-accent-fg)] shadow group-hover/slot:flex group-focus-within/slot:hidden"
      >
        <PencilIcon className="size-3" />
      </span>
    </span>
  )
}

// ---- pictures ---------------------------------------------------------------

function EditableImage({
  id,
  value,
  alt,
  ratio,
  className,
  enabled,
  onPick,
  onRemove,
}: ImageSlotRenderProps & {
  enabled: boolean
  onPick: (id: string, file: File) => Promise<void>
  onRemove: (id: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  // A full-bleed picture has square corners; everything else takes the theme's.
  const flat = className?.split(/\s+/).includes("rounded-none") ?? false
  const label = slotLabel(id)

  async function choose(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    try {
      await onPick(id, file)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const pill =
    "text-n-800 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12.5px] font-semibold shadow-md ring-1 ring-black/10 hover:bg-white"

  return (
    // w-full as the live picture has it: in a centred column the wrapper
    // would otherwise shrink to nothing around an image sized by its width.
    <div data-edit-image={id} className={cn("group/img relative w-full", className)}>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={alt}
          style={{ aspectRatio: ratio }}
          className={cn(radius, "w-full object-cover", flat && "rounded-none")}
        />
      ) : enabled ? (
        <button
          type="button"
          aria-label={`Add ${label.toLowerCase()}`}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="block w-full cursor-pointer text-left transition-opacity hover:opacity-80"
        >
          <ImagePlaceholder
            ratio={ratio}
            className={flat ? "rounded-none" : undefined}
            label={busy ? "Preparing…" : "Add image"}
          />
        </button>
      ) : (
        <ImagePlaceholder
          ratio={ratio}
          className={flat ? "rounded-none" : undefined}
          label="Image"
        />
      )}

      {value && enabled ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/25 opacity-0 transition-opacity group-hover/img:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={pill}
          >
            <ImagePlusIcon className="size-3.5" />
            {busy ? "Preparing…" : "Change image"}
          </button>
          <button type="button" onClick={() => onRemove(id)} className={pill}>
            <XIcon className="size-3.5" />
            Remove image
          </button>
        </div>
      ) : null}

      {enabled ? (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          aria-label={`Choose ${label.toLowerCase()}`}
          className="hidden"
          onChange={(event) => void choose(event.target.files)}
        />
      ) : null}
    </div>
  )
}
