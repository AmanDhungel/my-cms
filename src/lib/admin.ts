/**
 * What the admin area lists. Shared so the client hooks do not have to point
 * at a route handler for their types.
 */

export type AdminBusiness = {
  id: string
  name: string
  crewSize: string
  timeZone: string
  blockedAt: string | null
  createdAt: string
  owner: { name: string; email: string } | null
  counts: { users: number; projects: number; tasks: number; bills: number; items: number }
}

export type AdminUser = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  blockedAt: string | null
  superAdmin: boolean
  createdAt: string
  business: { id: string; name: string; blockedAt: string | null } | null
}

export type AdminProject = {
  id: string
  name: string
  site: string | null
  status: string
  createdAt: string
  business: { id: string; name: string } | null
  tasks: number
}
