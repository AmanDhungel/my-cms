"use client"

import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from "@/lib/storage/types"

/**
 * Squeezing a picture under the ceiling, in the browser.
 *
 * A phone camera produces four or five megabytes, which is slow to upload,
 * slow to serve and no sharper on a web page. Doing the squeeze here, before
 * anything is sent, is what keeps the server's limit a hard one — it never
 * has to decode a photograph to decide whether to keep it.
 */

/**
 * The same list storage accepts: one allowlist, shared rather than copied.
 * No SVG — it can carry script, and the server refuses it with 415, so the
 * browser refuses it first rather than letting a pick fail at upload.
 */
export const ACCEPTED_TYPES = UPLOAD_CONTENT_TYPES

/** Beyond this a picture is only costing bytes, not showing more. */
const MAX_EDGE = 2000

/** Where the picture goes once quality alone has not done it. */
const EDGE_STEPS = [1600, 1200, 1000] as const

/**
 * Quality first, then size. Re-encoding at lower quality is nearly invisible
 * on a photograph and usually enough on its own; scaling down loses detail
 * that cannot come back, so it is only reached for when quality alone has
 * not done it.
 */
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.5] as const

export function isAcceptedType(type: string) {
  return (ACCEPTED_TYPES as readonly string[]).includes(type)
}

/** "820 KB", for the line under a preview. */
export function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The picture, under the ceiling, or an error saying why it cannot be.
 *
 * A file already under the ceiling is returned as the very same object —
 * re-encoding a small PNG would make it bigger and lose its transparency
 * for nothing, and a caller comparing identity can tell nothing happened.
 * Anything that is not an accepted picture — an SVG included — is refused
 * before a decode is attempted, with the same words the server uses, so the
 * person hears one message whichever side catches it.
 *
 * Bounded on both axes: five quality steps at each of four sizes, and then
 * it gives up with an error rather than sending something over the limit for
 * the server to refuse.
 */
export async function compressImageIfNeeded(
  file: File,
  opts: { maxBytes?: number } = {}
): Promise<File> {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES

  if (!isAcceptedType(file.type)) {
    throw new Error("Images only — JPEG, PNG, WebP or AVIF")
  }
  if (file.size <= maxBytes) return file

  const format = await outputFormat()
  const bitmap = await loadBitmap(file)

  try {
    const source = { width: bitmap.width, height: bitmap.height }
    let last = ""

    for (const edge of [MAX_EDGE, ...EDGE_STEPS]) {
      const { width, height } = fitWithin(source, edge)

      // A picture smaller than the step comes back at the size it was; the
      // ladder has already failed at that size, so it is not run again.
      const at = `${width}x${height}`
      if (at === last) continue
      last = at

      for (const quality of QUALITY_STEPS) {
        const blob = await encode(bitmap, width, height, format, quality)
        // No blob is a canvas that cannot draw, not a picture that is too
        // big; retrying it at another size would only fail the same way.
        if (!blob) throw new Error("That file could not be read as a picture")
        if (blob.size <= maxBytes) return named(file, blob, format)
      }
    }

    throw new Error(
      "That picture is still over 1 MB after compressing. Try a smaller one."
    )
  } finally {
    bitmap.close?.()
  }
}

/** Scale so the longest edge is at most `edge`, never up. */
function fitWithin(size: { width: number; height: number }, edge: number) {
  const longest = Math.max(size.width, size.height)
  if (longest <= edge) return size
  const scale = edge / longest
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  }
}

type OutputFormat = "image/webp" | "image/jpeg"

let probed: Promise<OutputFormat> | null = null

/**
 * WebP where the browser can write it, JPEG where it cannot.
 *
 * Asked once and remembered: the answer does not change between pictures,
 * and the probe is a canvas encode of its own. Safari accepts "image/webp"
 * and hands back a PNG, so the blob's own type is checked rather than the
 * absence of an error.
 */
function outputFormat(): Promise<OutputFormat> {
  probed ??= new Promise<OutputFormat>((resolve) => {
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      canvas.toBlob(
        (blob) =>
          resolve(blob?.type === "image/webp" ? "image/webp" : "image/jpeg"),
        "image/webp",
        0.8
      )
    } catch {
      resolve("image/jpeg")
    }
  })
  return probed
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
  format: OutputFormat,
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
    canvas.toBlob((blob) => resolve(blob), format, quality)
  })
}

/** Keeps the original stem so a download is still recognisable. */
function named(original: File, blob: Blob, format: OutputFormat) {
  const stem = original.name.replace(/\.[^.]+$/, "") || "picture"
  const ext = format === "image/webp" ? "webp" : "jpg"
  return new File([blob], `${stem}.${ext}`, {
    type: format,
    lastModified: Date.now(),
  })
}
