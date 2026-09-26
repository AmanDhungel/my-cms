import type { UploadContentType } from "@/lib/storage/types"

/**
 * What a file actually is, read from its first bytes.
 *
 * A browser's `file.type` comes from the filename's extension, and an
 * extension is whatever the sender says it is. The bytes are not: every
 * image format opens with a fixed signature, so a renamed HTML page or an SVG
 * with a script inside answers null here and never reaches the bucket.
 */
export function sniffImageType(bytes: Uint8Array): UploadContentType | null {
  if (isJpeg(bytes)) return "image/jpeg"
  if (isPng(bytes)) return "image/png"
  if (isWebp(bytes)) return "image/webp"
  if (isAvif(bytes)) return "image/avif"
  return null
}

/**
 * A signature is a handful of bytes anyone can paste in front of anything,
 * so each detector below also reads the first piece of structure that every
 * real file of that format must have right after it. A PNG signature with an
 * HTML page behind it has no IHDR chunk, and so answers null.
 */

/**
 * JPEG: SOI (FF D8) then the first marker, FF xx where xx is a marker code
 * in C0..FE. A fourth byte of FF is only padding, never a marker, and
 * anything below C0 is not a marker at all — so "FF D8 FF" alone was not
 * enough.
 */
function isJpeg(b: Uint8Array) {
  return (
    b.length >= 4 &&
    b[0] === 0xff &&
    b[1] === 0xd8 &&
    b[2] === 0xff &&
    b[3] >= 0xc0 &&
    b[3] <= 0xfe
  )
}

/**
 * PNG: the 8-byte signature, then a 4-byte chunk length, then the chunk type
 * at 12..15 — which must be "IHDR", the header chunk every PNG opens with.
 * The signature alone was not enough because it is only a prefix.
 */
function isPng(b: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return (
    b.length >= 16 &&
    signature.every((byte, i) => b[i] === byte) &&
    ascii(b, 12, 16) === "IHDR"
  )
}

/**
 * WebP: a RIFF container ("RIFF" at 0..3, "WEBP" at 8..11) whose first chunk
 * at 12..15 is one of the three WebP bitstream chunks — lossy "VP8 ",
 * lossless "VP8L", or extended "VP8X". RIFF and the WEBP form tag say only
 * what container it claims to be; the chunk is what makes it a picture.
 */
function isWebp(b: Uint8Array) {
  if (b.length < 16) return false
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 12) !== "WEBP") return false
  const chunk = ascii(b, 12, 16)
  return chunk === "VP8 " || chunk === "VP8L" || chunk === "VP8X"
}

/**
 * AVIF is a box inside an ISO base media file: a length, then "ftyp", then
 * the major brand and however many compatible brands fit in the box. Any
 * of them naming avif (still) or avis (sequence) is enough — encoders
 * differ over which slot they use.
 */
function isAvif(b: Uint8Array) {
  if (b.length < 12 || ascii(b, 4, 8) !== "ftyp") return false

  // Unsigned: a top bit set would otherwise read as a negative size.
  const boxSize = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
  // A box claiming to be shorter than its own header yields only its major
  // brand; one longer than the bytes held, or than any real ftyp box, is
  // read only as far as a real one goes — a brand cannot hide in the data.
  const end = Math.min(boxSize >= 16 ? boxSize : 16, b.length, 256)

  const brands = [ascii(b, 8, 12)]
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(ascii(b, offset, offset + 4))
  }
  return brands.some((brand) => brand === "avif" || brand === "avis")
}

function ascii(b: Uint8Array, from: number, to: number) {
  let out = ""
  for (let i = from; i < to; i += 1) out += String.fromCharCode(b[i])
  return out
}
