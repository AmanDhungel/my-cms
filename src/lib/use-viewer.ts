"use client"

import { useSession } from "next-auth/react"

/**
 * Who is looking, for hiding controls they can't use. The server decides
 * (lib/auth/permissions.ts); this only keeps the page from offering a
 * delete that would be refused. Until the session loads nobody counts as
 * the owner, so a control is never shown and then taken away.
 */
export function useViewer() {
  const { data } = useSession()
  const id = data?.user?.id ?? ""
  const isOwner = data?.user?.role === "owner"
  return {
    id,
    isOwner,
    /** Owner: anything. Everyone else: only pictures recorded as theirs. */
    mayRemovePicture: (uploadedBy?: string | null) =>
      isOwner || (!!id && !!uploadedBy && uploadedBy === id),
  }
}
