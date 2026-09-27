import { Types } from "mongoose"

import { Business } from "@/models/business"
import { User } from "@/models/user"

type WorkspaceDocument = ReturnType<typeof Business.hydrate>

/** The account fields every membership check reads. */
const MEMBER_FIELDS = {
  name: 1,
  email: 1,
  role: 1,
  business: 1,
  status: 1,
  blockedAt: 1,
  sessionsValidAfter: 1,
} as const

/**
 * The account and its workspace in one round trip.
 *
 * Every API request and page checks membership against the database, and
 * used to do it as a lookup plus a populate — two round trips to a cluster
 * about 50 ms away — before the route read the workspace a third time.
 * Joining them here makes it one. Both come back hydrated, so defaults and
 * getters are exactly what `findById` would have given.
 */
export async function loadMembership(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    // Not an id at all: fail exactly as the lookup always has (a CastError).
    await User.findById(userId).select("_id")
    return null
  }

  const [row] = await User.aggregate<Record<string, unknown> & { workspace: unknown[] }>([
    { $match: { _id: new Types.ObjectId(userId) } },
    { $project: MEMBER_FIELDS },
    {
      $lookup: {
        from: Business.collection.collectionName,
        localField: "business",
        foreignField: "_id",
        as: "workspace",
      },
    },
  ])
  if (!row) return null

  const { workspace, ...member } = row
  return {
    member: User.hydrate(member),
    business: workspace[0] ? Business.hydrate(workspace[0]) : null,
  }
}

/**
 * The workspace loaded with a viewer, for the rest of that request.
 *
 * Keyed by the viewer object the guard returned, which lives exactly as
 * long as the request that asked for it: nothing is shared between
 * requests, and `getWorkspace(viewer)` costs no second read.
 */
const loaded = new WeakMap<object, WorkspaceDocument>()

export function rememberWorkspace(viewer: object, business: WorkspaceDocument) {
  loaded.set(viewer, business)
}

export function rememberedWorkspace(viewer: object) {
  return loaded.get(viewer)
}
