"use client"

/**
 * Pictures, from the moment someone picks one to the moment it is saved.
 *
 * Two rules drive everything here. Nothing is uploaded when a file is chosen
 * — only when the form is submitted — so abandoning a half-filled form leaves
 * nothing behind in the bucket. And nothing over a megabyte is ever sent: a
 * phone camera produces four or five, which is slow to upload, slow to serve
 * and no sharper on a web page.
 */

/** A megabyte, which is the ceiling everything here works towards. */
export const MAX_BYTES = 1024 * 1024

/** Beyond this a picture is only costing bytes, not showing more. */
const MAX_EDGE = 2000

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

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

export function isAcceptedType(type: string) {
  return (ACCEPTED_TYPES as readonly string[]).includes(type)
}

/**
 * Squeeze a picture under the ceiling.
 *
 * Two levers, pulled in the order that costs the least: quality first, then
 * size. Re-encoding at lower quality is nearly invisible on a photograph and
 * usually enough on its own; scaling down loses detail that cannot come back,
 * so it is only reached for when quality alone has not done it.
 *
 * A file already under the ceiling is returned untouched — re-encoding a
 * small PNG would make it bigger and lose its transparency for nothing.
 */
export async function compressImage(
  file: File,
  maxBytes = MAX_BYTES
): Promise<File> {
  if (file.size <= maxBytes) return file
  if (!isAcceptedType(file.type)) return file

  const bitmap = await loadBitmap(file)

  try {
    let width = bitmap.width
    let height = bitmap.height

    // One free win before touching quality: a 6000px photo is pointless on a
    // page that will never show it wider than about a thousand.
    const longest = Math.max(width, height)
    if (longest > MAX_EDGE) {
      const scale = MAX_EDGE / longest
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    /*
     * Quality, coming down in steps, then the picture gets smaller and the
     * ladder is climbed again. Bounded on both axes so a pathological input
     * cannot spin: eight quality steps, four scalings, and it gives up with
     * the smallest thing it managed rather than looping.
     */
    let best: Blob | null = null

    for (let attempt = 0; attempt < 4; attempt += 1) {
      for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4, 0.32, 0.25, 0.2]) {
        const blob = await encode(bitmap, width, height, quality)
        if (!blob) break
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= maxBytes) {
          return named(file, blob)
        }
      }
      width = Math.round(width * 0.75)
      height = Math.round(height * 0.75)
      if (width < 320 || height < 320) break
    }

    // Still over. The smallest we managed beats the original either way.
    if (best && best.size < file.size) return named(file, best)
    return file
  } finally {
    bitmap.close?.()
  }
}

async function loadBitmap(file: File) {
  // createImageBitmap decodes off the main thread where it exists, which
  // matters for a 12-megapixel photo.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file)
  }

  return new Promise<HTMLImageElement & { close?: () => void }>(
    (resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error("That file could not be read as a picture"))
      }
      img.src = url
    }
  )
}

function encode(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.resolve(null)

  // White underneath: a transparent PNG re-encoded as JPEG would otherwise
  // come out with black where the transparency was.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, width, height)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
  })
}

/** Keeps the original stem so a download is still recognisable. */
function named(original: File, blob: Blob) {
  const stem = original.name.replace(/\.[^.]+$/, "") || "picture"
  return new File([blob], `${stem}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
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

  const compressed = await compressImage(file)
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
 */
export async function commitImage(
  draft: ImageDraft,
  purpose: string
): Promise<string | null> {
  if (!draft.file) return draft.url

  const signed = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      contentType: draft.file.type,
      size: draft.file.size,
    }),
  })

  const ticket = (await signed.json()) as {
    uploadUrl?: string
    url?: string
    error?: string
  }
  if (!signed.ok || !ticket.uploadUrl || !ticket.url) {
    throw new Error(ticket.error ?? "The upload couldn't be started")
  }

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": draft.file.type },
    body: draft.file,
  })
  // S3 answers the PUT itself; a failure here is the bucket's, not ours.
  if (!put.ok) throw new Error("The picture didn't reach storage")

  return ticket.url
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

/** "820 KB", for the line under a preview. */
export function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
