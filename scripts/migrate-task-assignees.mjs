/**
 * Moves tasks from one assignee to a crew.
 *
 *   node scripts/migrate-task-assignees.mjs          # report only
 *   node scripts/migrate-task-assignees.mjs --write  # apply
 *
 * Additive and idempotent: `assignees` and `openCheckIns` are written, while
 * the old `assignee` and `checkedInAt` fields are left in place so the change
 * can be rolled back by pointing the code at them again.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import mongoose from "mongoose"

const here = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(resolve(here, "..", ".env.local"), "utf8")
const uri = env.match(/^MONGODB_URI\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
const dbName = env.match(/^MONGODB_DB\s*=\s*"?([^"\r\n]+)"?/m)?.[1]

if (!uri) {
  console.error("No MONGODB_URI in .env.local")
  process.exit(1)
}

const write = process.argv.includes("--write")

await mongoose.connect(uri, { dbName })
const tasks = mongoose.connection.db.collection("tasks")

const pending = await tasks
  .find({ assignee: { $exists: true }, assignees: { $exists: false } })
  .toArray()

console.log(`tasks needing migration: ${pending.length}`)

for (const task of pending) {
  const assignees = [task.assignee]
  // A task someone was standing on keeps that visit, now keyed by person.
  const openCheckIns = task.checkedInAt
    ? [{ user: task.assignee, at: task.checkedInAt }]
    : []

  console.log(
    `  ${task._id} "${task.title}" -> 1 assignee, ${openCheckIns.length} open check-in`
  )

  if (write) {
    await tasks.updateOne(
      { _id: task._id },
      { $set: { assignees, openCheckIns } }
    )
  }
}

// Anything already migrated but missing the array default.
const missingArray = await tasks.updateMany(
  { assignees: { $exists: true }, openCheckIns: { $exists: false } },
  { $set: { openCheckIns: [] } }
)

console.log(
  write
    ? `applied. also backfilled ${missingArray.modifiedCount} empty check-in arrays`
    : "dry run — nothing written. re-run with --write to apply"
)

const left = await tasks.countDocuments({ assignees: { $exists: false } })
console.log(`tasks still without an assignees array: ${left}`)

await mongoose.disconnect()
