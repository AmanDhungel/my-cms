/**
 * Finds every stored picture address that still points at the old bucket
 * (AWS_LEGACY_BUCKET_NAME) and, when asked, moves it to the new one.
 *
 *   node scripts/migrate-legacy-urls.mjs                 # report only
 *   node scripts/migrate-legacy-urls.mjs --write         # rewrite links whose
 *                                                        # object is already in
 *                                                        # AWS_BUCKET_NAME
 *   node scripts/migrate-legacy-urls.mjs --copy --write  # copy missing objects
 *                                                        # across first, then
 *                                                        # rewrite
 *
 * Options: --env <path> reads another .env file (default: ../.env.local);
 * --legacy <bucket> overrides AWS_LEGACY_BUCKET_NAME.
 *
 * Looks at: site content (hero, about, product and gallery pictures) and
 * siteImageUploaders, inventory item images, business logos, maintenance
 * photos and photoUploaders, and ticket photos. Each link is rewritten to
 * AWS_PUBLIC_BASE_URL/<key> — the same key, served through the CDN. The app
 * already serves old links that way at read time; this makes the stored data
 * match, and --copy makes sure the objects are actually there.
 *
 * Idempotent: a second run finds nothing left to do. Report mode writes
 * nothing, to the database or the bucket; it only reads (including a HEAD
 * per object in the new bucket, to say which are already there).
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import mongoose from "mongoose"
import {
  CopyObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

const here = dirname(fileURLToPath(import.meta.url))
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const envPath = arg("--env") ?? resolve(here, "..", ".env.local")
const env = readFileSync(envPath, "utf8")
const read = (name) => env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m"))?.[1] || undefined

const write = process.argv.includes("--write")
const copy = process.argv.includes("--copy")
const LEGACY = (arg("--legacy") ?? read("AWS_LEGACY_BUCKET_NAME") ?? "").toLowerCase()
const BUCKET = read("AWS_BUCKET_NAME")
const REGION = read("AWS_REGION")
const BASE = read("AWS_PUBLIC_BASE_URL")?.replace(/\/+$/, "")

for (const [name, value] of [["MONGODB_URI", read("MONGODB_URI")], ["AWS_BUCKET_NAME", BUCKET], ["AWS_REGION", REGION], ["AWS_PUBLIC_BASE_URL", BASE], ["the legacy bucket (AWS_LEGACY_BUCKET_NAME or --legacy)", LEGACY]]) {
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
}
if (copy && !write) {
  console.error("--copy only runs together with --write")
  process.exit(1)
}

const S3_HOST = /^s3(?:[.-](?:dualstack\.)?[a-z0-9-]+)?\.amazonaws\.com$/

/** The key behind an address into the legacy bucket, or null. */
function legacyKey(url) {
  if (typeof url !== "string" || !url) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  let path
  try {
    path = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  if (host.startsWith(`${LEGACY}.`) && S3_HOST.test(host.slice(LEGACY.length + 1))) {
    return path.slice(1) || null
  }
  if (S3_HOST.test(host) && path.startsWith(`/${LEGACY}/`)) {
    return path.slice(LEGACY.length + 2) || null
  }
  return null
}

const cdnUrl = (key) => `${BASE}/${key}`

const credentials = { accessKeyId: read("AWS_ACCESS_KEY_ID"), secretAccessKey: read("AWS_SECRET_ACCESS_KEY") }
// The legacy bucket may live in another region; the SDK follows S3's
// redirect to it rather than failing.
const s3 = new S3Client({ region: REGION, credentials, followRegionRedirects: true })

await mongoose.connect(read("MONGODB_URI"), { dbName: read("MONGODB_DB") })
const db = mongoose.connection.db

/*
 * Every place a picture address is stored: the collection, and how to list
 * (path, url) pairs in one document. Paths are dot paths for $set.
 */
const SOURCES = [
  ["sites", "site content + siteImageUploaders", (doc) => [
    ["content.hero.image", doc.content?.hero?.image],
    ["content.about.image", doc.content?.about?.image],
    ...(doc.content?.products ?? []).map((one, i) => [`content.products.${i}.image`, one?.image]),
    ...(doc.content?.gallery ?? []).map((one, i) => [`content.gallery.${i}.url`, one?.url]),
    ...(doc.siteImageUploaders ?? []).map((one, i) => [`siteImageUploaders.${i}.url`, one?.url]),
  ]],
  ["inventoryitems", "inventory item images", (doc) => (doc.images ?? []).map((one, i) => [`images.${i}.url`, one?.url])],
  ["businesses", "business logo", (doc) => [["logo.url", doc.logo?.url]]],
  ["maintenanceitems", "maintenance photos + photoUploaders", (doc) => [
    ...(doc.photos ?? []).map((url, i) => [`photos.${i}`, url]),
    ...(doc.photoUploaders ?? []).map((one, i) => [`photoUploaders.${i}.url`, one?.url]),
  ]],
  ["tickets", "ticket photos", (doc) => (doc.photos ?? []).map((one, i) => [`photos.${i}.url`, one?.url])],
]

const found = [] // { coll, id, path, url, key }
const perSource = []
for (const [coll, label, fieldsOf] of SOURCES) {
  const pattern = new RegExp(`(^https?://${LEGACY.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`)}\\.s3[.-])|(amazonaws\\.com/${LEGACY}/)`, "i")
  let count = 0
  const docs = db.collection(coll).find({})
  for await (const doc of docs) {
    for (const [path, url] of fieldsOf(doc)) {
      if (typeof url !== "string" || !pattern.test(url)) continue
      const key = legacyKey(url)
      if (!key) continue
      found.push({ coll, id: doc._id, path, url, key })
      count++
    }
  }
  perSource.push([label, count])
}

const keys = [...new Set(found.map((one) => one.key))]
const present = new Set()
for (const key of keys) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    present.add(key)
  } catch {
    // Not in the new bucket (or unreadable): counted as missing.
  }
}
const outsideScope = keys.filter((key) => !key.startsWith("businesses/"))

console.log(`Legacy bucket: ${LEGACY}  →  new bucket: ${BUCKET}, served from ${BASE}`)
console.log(`Mode: ${write ? (copy ? "COPY + WRITE" : "WRITE (present objects only)") : "report only (nothing is written)"}`)
console.log("")
console.log("Stored links still pointing at the legacy bucket:")
for (const [label, count] of perSource) console.log(`  ${label.padEnd(40)} ${count}`)
console.log(`  ${"total links".padEnd(40)} ${found.length}`)
console.log(`  ${"distinct objects".padEnd(40)} ${keys.length}`)
console.log(`  ${"  already in the new bucket".padEnd(40)} ${present.size}`)
console.log(`  ${"  missing from the new bucket".padEnd(40)} ${keys.length - present.size}  (served as broken images until copied)`)
console.log(`  ${"  keys outside businesses/".padEnd(40)} ${outsideScope.length}  (the OAC policy covers businesses/* only)`)
if (found.length) {
  console.log("")
  console.log("Examples (collection · field · key · in new bucket?):")
  for (const one of found.slice(0, 15)) {
    console.log(`  ${one.coll} ${String(one.id)} · ${one.path} · ${one.key} · ${present.has(one.key) ? "yes" : "no"}`)
  }
  if (found.length > 15) console.log(`  … and ${found.length - 15} more`)
}

if (write) {
  let copied = 0
  if (copy) {
    for (const key of keys.filter((k) => !present.has(k))) {
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: LEGACY, Key: key }))
        await s3.send(new CopyObjectCommand({
          Bucket: BUCKET,
          Key: key,
          CopySource: `${LEGACY}/${key.split("/").map(encodeURIComponent).join("/")}`,
          MetadataDirective: "REPLACE",
          ContentType: head.ContentType,
          Metadata: head.Metadata,
          CacheControl: "public, max-age=31536000, immutable",
        }))
        present.add(key)
        copied++
      } catch (error) {
        console.error(`  could not copy ${key}: ${error?.name ?? error}`)
      }
    }
  }
  let rewritten = 0
  const byDoc = new Map()
  for (const one of found) {
    if (!present.has(one.key)) continue
    const id = `${one.coll}:${String(one.id)}`
    if (!byDoc.has(id)) byDoc.set(id, { coll: one.coll, _id: one.id, set: {} })
    byDoc.get(id).set[one.path] = cdnUrl(one.key)
  }
  for (const { coll, _id, set } of byDoc.values()) {
    await db.collection(coll).updateOne({ _id }, { $set: set })
    rewritten += Object.keys(set).length
  }
  console.log("")
  console.log(`Copied ${copied} object(s); rewrote ${rewritten} link(s) in ${byDoc.size} document(s).`)
  const skipped = found.filter((one) => !present.has(one.key)).length
  if (skipped) console.log(`Left ${skipped} link(s) whose object is not in the new bucket (run with --copy --write).`)
}

await mongoose.disconnect()
