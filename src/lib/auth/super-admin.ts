/**
 * Who may enter the admin area, read from the environment rather than from
 * the database — so no amount of writing to a collection can make an account
 * a super admin, and the list moves with the deployment.
 *
 * Kept free of imports: `auth.ts` needs it while signing someone in, and the
 * guard that uses it lives in `guards.ts`, which imports `auth.ts` in turn.
 */
function allowList() {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * An administrator address never comes in through an invite: it is who the
 * environment says it is, and an account under it is a super admin on its
 * first sign-in. Registering or accepting an invite with one is refused.
 */
export const SUPER_ADMIN_ADDRESS_MESSAGE =
  "That address is reserved. Use a different email."

export function isSuperAdmin(email?: string | null) {
  if (!email) return false
  return allowList().includes(email.trim().toLowerCase())
}
