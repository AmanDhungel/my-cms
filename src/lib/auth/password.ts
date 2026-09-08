import bcrypt from "bcryptjs"

/** Deliberately slow. Raise as hardware gets faster. */
const COST = 12

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST)
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * A real hash of a throwaway value. Login compares against this when the email
 * doesn't exist, so a missing account costs the same time as a wrong password
 * and can't be spotted by timing.
 */
export const DUMMY_HASH =
  "$2b$12$CN3pvJcK1tojtKxZItfDiOIr3Nv8bBH1p/S9iCVWlLe7/gVASXqlS"
