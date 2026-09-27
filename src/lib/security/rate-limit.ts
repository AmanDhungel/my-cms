import { createHash } from "node:crypto"
import { Schema, model, models, type Model } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { connectToDatabase } from "@/lib/mongodb"
import { RATE_LIMITS, type RateLimitName } from "@/lib/security/limits"

/**
 * A fixed-window rate limiter kept in MongoDB, so every instance of the app
 * counts against the same numbers.
 *
 * One document per key and window: `_id` is "<name>:<key-hash>:<windowStart>".
 * Each hit is one atomic upsert with `$inc`; documents expire on their own
 * through a TTL index shortly after their window ends.
 */

type Bucket = { _id: string; count: number; expiresAt: Date }

const bucketSchema = new Schema<Bucket>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "ratelimits" }
)
bucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RateLimitBucket: Model<Bucket> =
  (models.RateLimitBucket as Model<Bucket>) ??
  model<Bucket>("RateLimitBucket", bucketSchema)

/**
 * Limits can be switched off for a local test run only (RATE_LIMITS=off).
 * A production build always enforces them.
 */
export function rateLimitsEnabled() {
  return process.env.NODE_ENV === "production" || process.env.RATE_LIMITS !== "off"
}

/** Keys are hashed, so no email or IP is stored in the collection. */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 32)

export async function limit(
  key: string,
  max: number,
  windowSec: number
): Promise<{ ok: boolean; retryAfter: number; count: number }> {
  if (!rateLimitsEnabled()) return { ok: true, retryAfter: 0, count: 0 }
  await connectToDatabase()
  const windowMs = windowSec * 1000
  const now = Date.now()
  const start = Math.floor(now / windowMs) * windowMs
  const end = start + windowMs
  const id = `${hash(key)}:${start}`
  const bump = () =>
    RateLimitBucket.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(end + 60_000) } },
      { upsert: true, returnDocument: "after" }
    ).lean()
  let doc
  try {
    doc = await bump()
  } catch (error) {
    // Two first hits in the same window race to insert; the loser retries
    // as an update.
    if ((error as { code?: number }).code !== 11000) throw error
    doc = await bump()
  }
  const count = doc?.count ?? 1
  return {
    ok: count <= max,
    retryAfter: Math.max(1, Math.ceil((end - now) / 1000)),
    count,
  }
}

/** A named limit from RATE_LIMITS. */
export function limitBy(name: RateLimitName, key: string) {
  const { max, windowSec } = RATE_LIMITS[name]
  return limit(`${name}:${key}`, max, windowSec)
}

export function tooManyMessage(retryAfter: number) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60))
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
}

/** Throws a 429 (with Retry-After, via handleApiError) when over the limit. */
export async function enforceLimit(name: RateLimitName, key: string) {
  const result = await limitBy(name, key)
  if (!result.ok) {
    throw new HttpError(429, tooManyMessage(result.retryAfter), undefined, {
      "Retry-After": String(result.retryAfter),
    })
  }
  return result
}
