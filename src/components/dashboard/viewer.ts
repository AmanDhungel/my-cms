import type { UserRole } from "@/models/user"

/** What both shells need to know about whoever is signed in. */
export type Viewer = {
  name: string
  email: string
  role: UserRole
  businessName: string
}

/** "Balaju Logistics" -> "BL". Used for the workspace and avatar chips. */
export function initialsOf(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "??"
  const letters = parts.slice(0, 2).map((part) => part[0])
  return letters.join("").toUpperCase()
}
