/**
 * Removes test data from the database and storage, keeping every real account.
 *
 *   node scripts/cleanup-test-data.mjs                     # DRY RUN (default)
 *   node scripts/cleanup-test-data.mjs --write             # delete
 *
 * Options: --env <path> reads another .env file (default ../.env.local);
 * --legacy <bucket> names the old bucket when AWS_LEGACY_BUCKET_NAME is unset.
 *
 * Test data, and nothing else:
 *   - users whose email ends in @emstest.local
 *   - businesses owned by such a user, and every document that belongs to
 *     them (every collection with a `business` field)
 *   - invites issued or used by a test account (workspace invites from the
 *     test super admin included, pending ones too)
 *   - rate-limit rows keyed on a test account (their keys are hashes, so
 *     they are recomputed from each test account's email and id)
 *   - sessions: none are stored — sign-in is a JWT cookie
 *   - S3 objects of those businesses in BOTH buckets: businesses/<id>/… and
 *     the older <purpose>/<id>/… roots (site, sites, maintenance, ticket)
 *
 * Safety:
 *   - a business with ANY member whose email is not @emstest.local is
 *     skipped entirely (its test members are kept too) and listed;
 *   - a user whose email is not @emstest.local is never deleted;
 *   - anything owned by or belonging to PROTECTED_EMAIL is never touched;
 *   - an invite that created or belongs to a kept business is kept.
 *
 * --write deletes in this order: S3 objects → business-owned documents →
 * businesses → invites → sessions → users, in batches, then counts again
 * (nothing test should remain) and lists the kept accounts again (must match
 * the dry run). Idempotent: a second run finds nothing to do.
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import mongoose from "mongoose"
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"

const PROTECTED_EMAIL = "aman.most100@gmail.com"
const TEST_EMAIL = /@emstest\.local$/i
const LEGACY_ROOTS = ["site", "sites", "maintenance", "ticket"]
// Keyed on a user (lib/security/limits.ts): email for sign-in, id otherwise.
const LIMITS_BY_EMAIL = ["loginEmail"]
const LIMITS_BY_ID = ["uploads", "checkIn", "password"]

const here = dirname(fileURLToPath(import.meta.url))
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const env = readFileSync(arg("--env") ?? resolve(here, "..", ".env.local"), "utf8")
const read = (name) => env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m"))?.[1] || undefined
const write = process.argv.includes("--write")

const BUCKETS = [...new Set([read("AWS_BUCKET_NAME"), read("AWS_LEGACY_BUCKET_NAME") ?? arg("--legacy")].filter(Boolean))]
if (!read("MONGODB_URI")) {
  console.error("Missing MONGODB_URI")
  process.exit(1)
}

const s3 = new S3Client({
  region: read("AWS_REGION"),
  credentials: { accessKeyId: read("AWS_ACCESS_KEY_ID"), secretAccessKey: read("AWS_SECRET_ACCESS_KEY") },
  followRegionRedirects: true,
})

await mongoose.connect(read("MONGODB_URI"), { dbName: read("MONGODB_DB") })
const db = mongoose.connection.db
const { ObjectId } = mongoose.Types
const ids = (list) => list.map((one) => one._id)
const str = (id) => String(id)

/** Everything the run is about to do, worked out from the data as it is now. */
async function plan() {
  const users = await db.collection("users").find({}).project({ email: 1, name: 1, role: 1, business: 1 }).toArray()
  const businesses = await db.collection("businesses").find({}).project({ name: 1, owner: 1 }).toArray()
  const byId = new Map(users.map((u) => [str(u._id), u]))
  const isTest = (u) => Boolean(u?.email) && TEST_EMAIL.test(u.email)
  const protectedUser = users.find((u) => u.email?.toLowerCase() === PROTECTED_EMAIL)

  const membersOf = new Map()
  for (const u of users) if (u.business) {
    const key = str(u.business)
    if (!membersOf.has(key)) membersOf.set(key, [])
    membersOf.get(key).push(u)
  }

  const testBusinesses = []
  const mixed = []
  for (const b of businesses) {
    const owner = byId.get(str(b.owner))
    if (!isTest(owner)) continue
    const members = membersOf.get(str(b._id)) ?? []
    const real = members.filter((m) => !isTest(m))
    const touchesProtected = protectedUser && (str(protectedUser.business) === str(b._id) || str(b.owner) === str(protectedUser._id))
    if (real.length || touchesProtected) mixed.push({ business: b, real })
    else testBusinesses.push(b)
  }
  const testBusinessIds = new Set(testBusinesses.map((b) => str(b._id)))

  // Test accounts in a skipped or real workspace stay, like the workspace.
  const testUsers = users.filter((u) => isTest(u) && (!u.business || testBusinessIds.has(str(u.business)) || !businesses.some((b) => str(b._id) === str(u.business))))
  const keptTestUsers = users.filter((u) => isTest(u) && !testUsers.includes(u))
  const testUserIds = new Set(testUsers.map((u) => str(u._id)))
  const realUsers = users.filter((u) => !isTest(u))

  // Invites: member invites and workspace (super admin) invites.
  const keepBusiness = (id) => id && !testBusinessIds.has(str(id)) && businesses.some((b) => str(b._id) === str(id))
  const memberInvites = await db.collection("invites").find({
    $or: [
      { business: { $in: [...testBusinessIds].map((id) => new ObjectId(id)) } },
      { invitedBy: { $in: [...testUserIds].map((id) => new ObjectId(id)) } },
      { acceptedBy: { $in: [...testUserIds].map((id) => new ObjectId(id)) } },
    ],
  }).project({ business: 1 }).toArray()
  const workspaceInvites = await db.collection("workspaceinvites").find({
    $or: [
      { invitedBy: { $in: [...testUserIds].map((id) => new ObjectId(id)) } },
      { acceptedBy: { $in: [...testUserIds].map((id) => new ObjectId(id)) } },
      { business: { $in: [...testBusinessIds].map((id) => new ObjectId(id)) } },
    ],
  }).project({ business: 1 }).toArray()
  const invites = {
    invites: memberInvites.filter((i) => !keepBusiness(i.business)),
    workspaceinvites: workspaceInvites.filter((i) => !keepBusiness(i.business)),
  }
  const invitesKept = memberInvites.length + workspaceInvites.length - invites.invites.length - invites.workspaceinvites.length

  // Rate-limit rows: keyed sha256("<name>:<key>").slice(0,32) + ":<window>".
  const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 32)
  const prefixes = new Set()
  for (const u of testUsers) {
    for (const name of LIMITS_BY_EMAIL) prefixes.add(hash(`${name}:${u.email.toLowerCase()}`))
    for (const name of LIMITS_BY_ID) prefixes.add(hash(`${name}:${str(u._id)}`))
  }
  const rateRows = (await db.collection("ratelimits").find({}).project({ _id: 1 }).toArray())
    .filter((row) => prefixes.has(String(row._id).split(":")[0]))

  // Documents that belong to a test business, per collection.
  const owned = {}
  const businessList = [...testBusinessIds].map((id) => new ObjectId(id))
  for (const { name } of await db.listCollections().toArray()) {
    if (["users", "businesses", "invites", "workspaceinvites", "ratelimits"].includes(name) || name.startsWith("system.")) continue
    const n = businessList.length ? await db.collection(name).countDocuments({ business: { $in: businessList } }) : 0
    if (n) owned[name] = n
  }

  const sessions = (await db.listCollections({ name: "sessions" }).toArray()).length
    ? await db.collection("sessions").countDocuments({ userId: { $in: [...testUserIds].map((id) => new ObjectId(id)) } })
    : 0

  return { users, businesses, realUsers, keptTestUsers, testUsers, testBusinesses, testBusinessIds, mixed, invites, invitesKept, rateRows, owned, sessions, businessList }
}

/** Every object under the test businesses' prefixes, per bucket. */
async function objects(testBusinessIds) {
  const out = {}
  for (const bucket of BUCKETS) {
    const keys = []
    const prefixes = [...testBusinessIds].flatMap((id) => [`businesses/${id}/`, ...LEGACY_ROOTS.map((root) => `${root}/${id}/`)])
    let next = 0
    await Promise.all(Array.from({ length: 12 }, async () => {
      while (next < prefixes.length) {
        const Prefix = prefixes[next++]
        let token
        do {
          const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix, ContinuationToken: token }))
          for (const o of page.Contents ?? []) if (o.Key?.startsWith(Prefix)) keys.push(o.Key)
          token = page.IsTruncated ? page.NextContinuationToken : undefined
        } while (token)
      }
    }))
    out[bucket] = keys
  }
  return out
}

function keptAccounts(p) {
  const nameOf = new Map(p.businesses.map((b) => [str(b._id), b.name]))
  return p.realUsers
    .map((u) => ({ email: u.email, name: u.name, business: nameOf.get(str(u.business)) ?? "(none)", role: u.role }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

function report(p, objs, title) {
  console.log(`\n=== ${title} ===`)
  console.log(`database: ${db.databaseName}   buckets: ${BUCKETS.join(", ")}`)
  console.log("\n(a) test data per collection")
  const rows = [
    ["users (@emstest.local)", p.testUsers.length],
    ["businesses (test-owned)", p.testBusinesses.length],
    ...Object.entries(p.owned).sort().map(([name, n]) => [`${name} (of test businesses)`, n]),
    ["invites (issued/used by test accounts)", p.invites.invites.length],
    ["workspaceinvites (issued/used by test accounts)", p.invites.workspaceinvites.length],
    ["ratelimits (keyed on test accounts)", p.rateRows.length],
    ["sessions", `${p.sessions} (none stored: sign-in is a JWT cookie)`],
  ]
  for (const [label, n] of rows) console.log(`  ${label.padEnd(50)} ${n}`)
  if (p.invitesKept) console.log(`  (kept: ${p.invitesKept} invite(s) that created or belong to a kept workspace)`)
  if (p.keptTestUsers.length) console.log(`  (kept: ${p.keptTestUsers.length} @emstest.local account(s) inside a kept workspace)`)
  console.log("\n(b) REAL accounts that are KEPT")
  for (const a of keptAccounts(p)) console.log(`  ${a.email.padEnd(34)} ${String(a.name).padEnd(22)} ${String(a.business).padEnd(30)} ${a.role}`)
  console.log("\n(c) skipped mixed businesses (a non-test member, or the protected account)")
  if (!p.mixed.length) console.log("  none")
  for (const m of p.mixed) console.log(`  ${m.business.name} (${str(m.business._id)}): real members ${m.real.map((u) => u.email).join(", ") || "(protected)"}`)
  console.log("\n(d) S3 objects of test businesses")
  for (const [bucket, keys] of Object.entries(objs)) console.log(`  ${bucket.padEnd(12)} ${keys.length}`)
}

const before = await plan()
const beforeObjects = await objects(before.testBusinessIds)
report(before, beforeObjects, write ? "BEFORE --write" : "DRY RUN (nothing is deleted)")

if (write) {
  const inBatches = async (list, size, fn) => { for (let i = 0; i < list.length; i += size) await fn(list.slice(i, i + size)) }
  // 1. S3 objects
  for (const [bucket, keys] of Object.entries(beforeObjects)) {
    await inBatches(keys, 1000, (batch) => s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } })))
  }
  // 2. business-owned documents (and rate-limit rows)
  for (const name of Object.keys(before.owned)) {
    await inBatches(before.businessList, 100, (batch) => db.collection(name).deleteMany({ business: { $in: batch } }))
  }
  await inBatches(ids(before.rateRows), 500, (batch) => db.collection("ratelimits").deleteMany({ _id: { $in: batch } }))
  // 3. businesses
  await inBatches(before.businessList, 100, (batch) => db.collection("businesses").deleteMany({ _id: { $in: batch }, owner: { $in: ids(before.testUsers) } }))
  // 4. invites
  await inBatches(ids(before.invites.invites), 500, (batch) => db.collection("invites").deleteMany({ _id: { $in: batch } }))
  await inBatches(ids(before.invites.workspaceinvites), 500, (batch) => db.collection("workspaceinvites").deleteMany({ _id: { $in: batch } }))
  // 5. sessions (none are stored today; kept for completeness)
  if (before.sessions) await db.collection("sessions").deleteMany({ userId: { $in: ids(before.testUsers) } })
  // 6. users — test addresses only, whatever the list says
  await inBatches(ids(before.testUsers), 200, (batch) => db.collection("users").deleteMany({ _id: { $in: batch }, email: TEST_EMAIL }))

  const after = await plan()
  const afterObjects = await objects(before.testBusinessIds)
  report(after, afterObjects, "AFTER --write")
  const same = JSON.stringify(keptAccounts(before)) === JSON.stringify(keptAccounts(after))
  console.log(`\nkept accounts identical to before: ${same ? "yes" : "NO — check the lists above"}`)
}

await mongoose.disconnect()
