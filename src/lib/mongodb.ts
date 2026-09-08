import mongoose, { type Mongoose } from "mongoose"

/**
 * Next.js hot-reloads modules in dev and runs route handlers in a long-lived
 * server process, so the connection is cached on `globalThis` to avoid opening
 * a new pool on every request / recompile.
 */
type MongooseCache = {
  conn: Mongoose | null
  promise: Promise<Mongoose> | null
}

declare global {
  var _mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = globalThis._mongooseCache ?? {
  conn: null,
  promise: null,
}

globalThis._mongooseCache = cached

export async function connectToDatabase(): Promise<Mongoose> {
  if (cached.conn) return cached.conn

  const uri = process.env.MONGODB_URI

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Add it to .env.local"
    )
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        dbName: process.env.MONGODB_DB,
      })
      .catch((error) => {
        // Reset so the next request can retry instead of reusing a failed promise.
        cached.promise = null
        throw error
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
