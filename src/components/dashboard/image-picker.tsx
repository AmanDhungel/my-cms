"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldLabel } from "@/components/auth/field"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import {
  ACCEPTED_TYPES,
  clearImage,
  emptyImage,
  hasImage,
  imageSrc,
  prepareImage,
  readableSize,
  type ImageDraft,
} from "@/lib/upload-client"

/**
 * Choosing a picture, without uploading it.
 *
 * Picking a file compresses it and shows it straight away from memory; the
 * bytes only leave the browser when the form around this is submitted. That
 * is what keeps an abandoned form from littering the bucket, and what lets
 * someone change their mind five times at no cost.
 */
export function ImagePicker({
  label,
  hint,
  value,
  onChange,
  enabled = true,
  ratio = "16/9",
  className,
}: {
  label: string
  hint?: string
  value: ImageDraft
  onChange: (next: ImageDraft) => void
  /** False when the server has no storage configured, so we say so up front. */
  enabled?: boolean
  ratio?: string
  className?: string
}) {
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const src = imageSrc(value)

  async function choose(file: File) {
    if (busy) return
    setBusy(true)
    try {
      onChange(await prepareImage(file, value))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That picture couldn't be read"
      )
    } finally {
      setBusy(false)
      // Cleared so choosing the same file twice still fires a change.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("flex flex-col gap-[7px]", className)}>
      <FieldLabel>{label}</FieldLabel>

      <div className="border-n-200 flex items-center gap-3 rounded-[10px] border bg-white p-2.5">
        <div
          style={{ aspectRatio: ratio }}
          className="bg-n-100 border-n-200 w-[104px] shrink-0 overflow-hidden rounded-md border"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-n-400 flex size-full items-center justify-center px-1 text-center font-mono text-[9px] tracking-[0.08em]">
              NO PICTURE
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {hint ? (
            <span className="text-n-500 text-[12px] leading-snug">{hint}</span>
          ) : null}

          {value.file ? (
            <span className="text-n-500 font-mono text-[11px]">
              {readableSize(value.file.size)} · uploads when you save
            </span>
          ) : null}

          {enabled ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold",
                  busy && "opacity-60"
                )}
              >
                {busy ? "Preparing…" : hasImage(value) ? "Replace" : "Choose"}
              </button>
              {hasImage(value) ? (
                <button
                  type="button"
                  onClick={() => onChange(clearImage(value))}
                  className="border-n-300 text-n-500 hover:text-s-overdue rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-s-overdue text-[12px]">
              File storage isn&apos;t configured on this server.
            </span>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        aria-label={label}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void choose(file)
        }}
      />
    </div>
  )
}

/**
 * Several pictures, for the things that have more than one — a maintenance
 * item photographed from three sides, or a site's gallery.
 */
export function ImagePickerList({
  label,
  hint,
  values,
  onChange,
  enabled = true,
  limit = 8,
  compact = false,
}: {
  label: string
  hint?: string
  values: ImageDraft[]
  onChange: (next: ImageDraft[]) => void
  enabled?: boolean
  limit?: number
  /**
   * Count as "2/3" and keep the add tile in place, disabled, once the list
   * is full — for short lists, where a tile vanishing reads as a glitch.
   */
  compact?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const chosen = values.filter((one) => one.file)
  const waiting = chosen.length
  const waitingBytes = chosen.reduce((sum, one) => sum + (one.file?.size ?? 0), 0)

  async function add(files: FileList) {
    if (busy) return
    setBusy(true)
    try {
      const room = limit - values.length
      const chosen = [...files].slice(0, Math.max(0, room))
      if (chosen.length < files.length) {
        toast.info(`Only ${limit} pictures fit here`)
      }

      const drafts: ImageDraft[] = []
      for (const file of chosen) {
        try {
          drafts.push(await prepareImage(file, emptyImage()))
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : `${file.name} couldn't be read`
          )
        }
      }
      if (drafts.length > 0) onChange([...values, ...drafts])
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        <span data-image-count className="text-n-400 font-mono text-[11px]">
          {compact ? `${values.length}/${limit}` : `${values.length} of ${limit}`}
        </span>
      </div>
      {hint ? (
        <span className="text-n-500 text-[12px] leading-snug">{hint}</span>
      ) : null}

      {waiting > 0 ? (
        <span className="text-n-500 font-mono text-[11px]">
          {waiting} new · {readableSize(waitingBytes)} · uploads when you save
        </span>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {values.map((draft, index) => (
          <figure
            key={index}
            data-picked-image
            className="border-n-200 relative m-0 size-[92px] overflow-hidden rounded-[10px] border bg-white"
          >
            {imageSrc(draft) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc(draft) ?? ""}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
            <button
              type="button"
              aria-label={`Remove picture ${index + 1}`}
              onClick={() => {
                clearImage(draft)
                onChange(values.filter((_, i) => i !== index))
              }}
              className="text-n-700 absolute top-1 right-1 rounded-md bg-white/90 px-1.5 text-[13px] leading-tight shadow-sm"
            >
              ×
            </button>
          </figure>
        ))}

        {enabled && (values.length < limit || compact) ? (
          <button
            type="button"
            disabled={busy || values.length >= limit}
            data-image-add
            onClick={() => inputRef.current?.click()}
            className="border-n-300 text-n-500 hover:bg-n-100 flex size-[92px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed bg-white text-[11.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
          >
            <PlusIcon className="size-4" />
            {busy ? "Preparing…" : values.length >= limit ? "Full" : "Add"}
          </button>
        ) : null}
      </div>

      {!enabled ? (
        <span className="text-s-overdue text-[12px]">
          File storage isn&apos;t configured on this server.
        </span>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        aria-label={label}
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (files && files.length > 0) void add(files)
        }}
      />
    </div>
  )
}
