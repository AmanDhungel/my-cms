import { HttpError } from "@/lib/api-response"
import type { UserRole } from "@/models/user"

/**
 * Who may delete what — the one rule every delete path asks.
 *
 * - The owner can delete anything.
 * - Supervisors and employees can never delete a record (a ticket, project,
 *   item, bill, expense, maintenance entry, attendance, request, member,
 *   invite, site content, the logo…).
 * - They can delete an image only when they uploaded it themselves, and an
 *   employee not even that on a ticket that is past (view-only).
 * - An image with no recorded uploader (saved before uploaders were tracked)
 *   is the owner's to remove.
 *
 * Removing a photo from an unsaved draft never reaches the server, so it is
 * not a delete; fresh uploads cleaned up after a failed save, and objects
 * displaced by an allowed replace, are the system tidying up and don't come
 * through here either.
 */
export type DeleteTarget =
  | { kind: "record" }
  | { kind: "image"; uploadedBy?: string | null; onPastTicket?: boolean }

export function canDelete(
  viewer: { id: string; role: UserRole },
  target: DeleteTarget
): boolean {
  if (viewer.role === "owner") return true
  if (target.kind === "record") return false
  if (!target.uploadedBy || target.uploadedBy !== viewer.id) return false
  if (viewer.role === "employee" && target.onPastTicket) return false
  return true
}

export const ONLY_OWNER_DELETES = "Only the owner can delete this."
export const ONLY_OWN_PICTURES = "You can only remove pictures you added."

/** For record DELETE handlers: 403 for everyone but the owner. */
export function assertCanDeleteRecord(viewer: { id: string; role: UserRole }) {
  if (!canDelete(viewer, { kind: "record" })) {
    throw new HttpError(403, ONLY_OWNER_DELETES)
  }
}

/**
 * For saves that drop or replace stored images: every one removed must be
 * the viewer's to delete, or the whole save is refused (403) and nothing
 * changes.
 */
export function assertCanRemoveImages(
  viewer: { id: string; role: UserRole },
  removed: readonly { uploadedBy?: string | null; onPastTicket?: boolean }[]
) {
  for (const image of removed) {
    if (!canDelete(viewer, { kind: "image", ...image })) {
      throw new HttpError(403, ONLY_OWN_PICTURES)
    }
  }
}
