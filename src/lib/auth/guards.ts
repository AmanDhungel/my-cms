import { auth } from "@/auth"
import { HttpError } from "@/lib/api-response"
import type { UserRole } from "@/models/user"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  businessId: string
}

/** Any signed-in member. Throws 401 otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  const user = session?.user

  if (!user?.id) {
    throw new HttpError(401, "Sign in to continue")
  }

  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role,
    businessId: user.businessId,
  }
}

/** A member holding one of `roles`. Throws 403 for everyone else. */
export async function requireRole(
  ...roles: readonly UserRole[]
): Promise<SessionUser> {
  const user = await requireUser()

  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You don't have access to that")
  }

  return user
}
