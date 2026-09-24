"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldLabel } from "@/components/auth/field"
import { UPLOAD_TYPES } from "@/lib/validations/site"

/**
 * One picture.
 *
 * The file goes straight from the browser to S3: this asks the server for a
 * signature, PUTs the bytes to the URL it gets back, and hands up the address
 * to store. A 5 MB photo never travels through the app server, and the AWS
 * keys never leave it.
 *
 * The check on type and size happens here as well as on the server — not as
 * security, which is the server's job, but so a mistake is caught before the
 * upload rather than after it.
 */
export function ImageField({
  label,
  hint,
  value,
  onChange,
  enabled,
  ratio = "16/9",
}: {
  label: string
  hint?: string
  value: string | null
  onChange: (url: string | null) => void
  /** False when the server has no S3 configured, so we say so up front. */
  enabled: boolean
  ratio?: string
}) {
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (busy) return

    if (!UPLOAD_TYPES.includes(file.type as (typeof UPLOAD_TYPES)[number])) {
      toast.error("Images only — JPEG, PNG, WebP or AVIF")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That picture is over 5 MB. Try a smaller one.")
      return
    }

    setBusy(true)
    try {
      const signed = await fetch("/api/site/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      })

      const body = (await signed.json()) as {
        uploadUrl?: string
        url?: string
        error?: string
      }
      if (!signed.ok || !body.uploadUrl || !body.url) {
        throw new Error(body.error ?? "The upload couldn't be started")
      }

      const put = await fetch(body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      // S3 answers the PUT itself; a failure here is the bucket's, not ours.
      if (!put.ok) throw new Error("The picture didn't reach storage")

      onChange(body.url)
      toast.success("Picture uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setBusy(false)
      // Cleared so choosing the same file twice still fires a change.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>

      <div className="border-n-200 flex items-center gap-3 rounded-[10px] border bg-white p-2.5">
        <div
          style={{ aspectRatio: ratio }}
          className="bg-n-100 border-n-200 w-[104px] shrink-0 overflow-hidden rounded-md border"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="size-full object-cover"
            />
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
                {busy ? "Uploading…" : value ? "Replace" : "Upload"}
              </button>
              {value ? (
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="border-n-300 text-n-500 hover:text-s-overdue rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-s-overdue text-[12px]">
              Picture uploads aren&apos;t configured on this server.
            </span>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_TYPES.join(",")}
        aria-label={label}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
    </div>
  )
}
