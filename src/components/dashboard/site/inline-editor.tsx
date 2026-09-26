"use client"

import * as React from "react"
import { ImagePlusIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  blankRow,
  editorContent,
  type SiteDraft,
} from "@/components/dashboard/site/site-draft"
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
 * Write one slot into the draft.
 *
 * A list that is still showing samples has no rows to write into. Editing a
 * sample row makes it the first real row — holding just what was typed —
 * and the other samples give way, because from then on the list is the
 * owner's own and shows only what they have put in it.
 */
function writeSlot(draft: SiteDraft, id: string, value: unknown): SiteDraft {
  const item = LIST_ITEM.exec(id)
  if (item) {
    const list = item[1] as ListSlotId
    const rows = draft[list] as unknown[]
    if (rows.length === 0) {
      return { ...draft, [list]: [{ ...blankRow(list), [item[3]]: value }] }
    }
    if (Number(item[2]) >= rows.length) return draft
  }
  return setPath(draft, id, value)
}

export function InlineEditor({
  template,
  draft,
  extraSlots,
  onDraft,
  onExtraSlots,
  onPreparing,
  uploads,
  errors,
}: {
  template: string
  draft: SiteDraft
  extraSlots: Record<string, string>
  onDraft: Setter<SiteDraft>
  onExtraSlots: Setter<Record<string, string>>
  /** Told +1 when a picture starts compressing and -1 when it is done. */
  onPreparing?: (delta: 1 | -1) => void
  uploads: boolean
  errors: Record<string, string>
}) {
  // A picture can finish compressing after the editor has gone (the page
  // was left). Its preview then has no one to show it and is let go of.
  const aliveRef = React.useRef(true)
  React.useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const renderer = React.useMemo<SlotRenderer>(() => {
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
      onDraft((prev) =>
        writeSlot(prev, id, text === "" ? (required ? "" : null) : text)
      )
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
      onDraft((prev) => {
        const old = getPath(prev, id) as ImageDraft | undefined
        // The picture it replaces is let go of here; revoking twice is
        // harmless, so this is safe under a double-invoked updater.
        if (old?.preview) URL.revokeObjectURL(old.preview)
        return writeSlot(prev, id, { ...next, url: old?.url ?? null })
      })
    }

    function removeImage(id: string) {
      onDraft((prev) => {
        const old = getPath(prev, id) as ImageDraft | undefined
        return old ? setPath(prev, id, clearImage(old)) : prev
      })
    }

    function addRow(list: ListSlotId) {
      onDraft((prev) => ({
        ...prev,
        [list]: [...(prev[list] as unknown[]), blankRow(list)],
      }))
    }

    function removeRow(list: ListSlotId, index: number) {
      onDraft((prev) => {
        const rows = prev[list] as Record<string, unknown>[]
        const row = rows[index]
        for (const value of Object.values(row ?? {})) {
          const image = value as ImageDraft | null
          if (image && typeof image === "object" && image.preview) {
            URL.revokeObjectURL(image.preview)
          }
        }
        return { ...prev, [list]: rows.filter((_, i) => i !== index) }
      })
    }

    const errorFor = (id: string) =>
      id.startsWith("heading.")
        ? errors[`extraSlots.${id}`]
        : errors[`content.${id}`]

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
      list: ({ id, count, children }: ListSlotRenderProps) => {
        const list = id as ListSlotId
        return (
          <>
            {children}
            {count < LIMITS[list] ? (
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
      item: ({ listId, index, sampled, children }: ListItemRenderProps) => (
        <div
          data-edit-row={`${listId}.${index}`}
          data-sample-row={sampled ? "" : undefined}
          className="group/row relative grid"
        >
          {children}
          {sampled ? null : (
            <button
              type="button"
              aria-label={`Remove ${LIST_NOUN[listId as ListSlotId]} ${index + 1}`}
              onClick={() => removeRow(listId as ListSlotId, index)}
              className="text-n-700 absolute -top-2.5 -right-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-white opacity-0 shadow-md ring-1 ring-black/10 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:text-red-600 focus-visible:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      ),
    }
  }, [errors, onDraft, onExtraSlots, onPreparing, uploads])

  const content = React.useMemo(() => editorContent(draft), [draft])

  return (
    <SlotRendererContext.Provider value={renderer}>
      <SiteRenderer
        template={template}
        content={content}
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
