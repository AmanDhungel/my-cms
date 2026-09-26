"use client"

import { compressImageIfNeeded, isAcceptedType } from "@/lib/images/compress"
import { MAX_UPLOAD_BYTES } from "@/lib/storage/types"

/**
 * Pictures, from the moment someone picks one to the moment it is saved.
 *
 * Two rules drive everything here. Nothing is uploaded when a file is chosen
 * — only when the form is submitted — so abandoning a half-filled form leaves
 * nothing behind in the bucket. And nothing over a megabyte is ever sent: a
 * phone camera produces four or five, which is slow to upload, slow to serve
 * and no sharper on a web page.
 *
 * The squeeze itself lives in `@/lib/images/compress`; the helpers it grew
 * are re-exported here so nothing that imported them has to move.
 */
export {
  ACCEPTED_TYPES,
  isAcceptedType,
  readableSize,
} from "@/lib/images/compress"

/**
 * The ceiling everything here works towards — the same one the server
 * enforces.
 */
export const MAX_BYTES = MAX_UPLOAD_BYTES

/** What the browser holds before a save: a chosen file, or an existing URL. */
export type ImageDraft = {
  /** Already uploaded, from a previous save. Null for a new picture. */
  url: string | null
  /** Chosen but not yet uploaded. Already compressed by the time it is here. */
  file: File | null
  /** An object URL for the preview. Revoked when it is replaced. */
  preview: string | null
}

export const emptyImage = (url: string | null = null): ImageDraft => ({
  url,
  file: null,
  preview: null,
})

/** What to show: the local preview if there is one, else what was saved. */
export function imageSrc(draft: ImageDraft) {
  return draft.preview ?? draft.url
}

export function hasImage(draft: ImageDraft) {
  return Boolean(draft.preview || draft.url)
}

/**
 * Squeeze a picture under the ceiling, handing the original back if it
 * cannot. This function never throws.
 *
 * The older entry point, kept only so that callers written against it keep
 * working. That version never threw: whatever went wrong — a file that was
 * not a picture, one that could not be squeezed under the limit, one that
 * could not be decoded, a canvas that would not draw — it handed the
 * original file back and left the caller to do its own size check. So this
 * wrapper catches EVERY error from `compressImageIfNeeded` and returns the
 * original file. Swallowing every failure is deliberate and is the whole
 * point of this export; do not narrow the catch to particular messages,
 * because any error escaping here is a behaviour change for code that was
 * never written to expect one.
 *
 * `prepareImage` below is the throwing path: new code goes through it and
 * gets told why a picture was refused.
 */
export async function compressImage(
  file: File,
  maxBytes = MAX_BYTES
): Promise<File> {
  try {
    return await compressImageIfNeeded(file, { maxBytes })
  } catch {
    return file
  }
}

/**
 * Take a chosen file and turn it into a draft, compressing on the way.
 *
 * Compression happens here rather than at submit so the size shown beside the
 * preview is the size that will actually be sent, and so a slow squeeze on a
 * big photo happens while the person is still filling the form rather than
 * when they press save.
 */
export async function prepareImage(
  file: File,
  previous?: ImageDraft
): Promise<ImageDraft> {
  if (!isAcceptedType(file.type)) {
    throw new Error("Images only — JPEG, PNG, WebP or AVIF")
  }

  const compressed = await compressImageIfNeeded(file, { maxBytes: MAX_BYTES })
  if (compressed.size > MAX_BYTES) {
    throw new Error(
      "That picture is still over 1 MB after compressing. Try a smaller one."
    )
  }

  // The old preview is a blob in memory until it is let go of.
  if (previous?.preview) URL.revokeObjectURL(previous.preview)

  return {
    // The saved URL is kept: it is only really replaced once the save lands,
    // and the server needs to know what it is replacing so it can tidy up.
    url: previous?.url ?? null,
    file: compressed,
    preview: URL.createObjectURL(compressed),
  }
}

export function clearImage(previous: ImageDraft): ImageDraft {
  if (previous.preview) URL.revokeObjectURL(previous.preview)
  return { url: null, file: null, preview: null }
}

/**
 * Upload what is waiting and return the address to store.
 *
 * Called at submit, never before. A draft with no file has nothing to do and
 * gives back whatever URL it already had, which is what makes it safe to run
 * over every picture on a form whether it changed or not.
 *
 * One request: the bytes go to our own endpoint as a form, which checks
 * what they really are before storing them. The browser sets the multipart
 * boundary itself, so no Content-Type header is given here.
 */
export async function commitImage(
  draft: ImageDraft,
  purpose: string
): Promise<string | null> {
  if (!draft.file) return draft.url

  const body = new FormData()
  body.set("purpose", purpose)
  body.set("file", draft.file, draft.file.name)

  const response = await fetch("/api/uploads", { method: "POST", body })

  const stored = (await response.json().catch(() => ({}))) as {
    key?: string
    url?: string
    error?: string
  }
  // A refusal without a reason came from something in front of the route —
  // a proxy, a body limit — so it is reported as never having started. A
  // success without an address is the stranger case: the request went
  // through and storage still gave nothing back.
  if (!response.ok) {
    throw new Error(stored.error ?? "The upload couldn't be started")
  }
  if (!stored.url) {
    throw new Error(stored.error ?? "The picture didn't reach storage")
  }

  return stored.url
}

/** The same, for a list — a gallery, or a maintenance item's photographs. */
export async function commitImages(
  drafts: ImageDraft[],
  purpose: string
): Promise<string[]> {
  const urls: string[] = []
  for (const draft of drafts) {
    const url = await commitImage(draft, purpose)
    if (url) urls.push(url)
  }
  return urls
}
