/**
 * Every rate limit in the app, in one place. `max` requests per `windowSec`
 * seconds, counted per key (an email, an IP, a user) in a fixed window.
 */
export const RATE_LIMITS = {
  /** Sign-in attempts, per email address. */
  loginEmail: { max: 5, windowSec: 15 * 60 },
  /** Sign-in attempts, per client IP. */
  loginIp: { max: 20, windowSec: 15 * 60 },
  /** Opening a workspace, per client IP. */
  register: { max: 5, windowSec: 60 * 60 },
  /** Accepting an invite (which sets a password), per client IP. */
  inviteAccept: { max: 5, windowSec: 60 * 60 },
  /** Changing or resetting a password, per account (no such route yet). */
  password: { max: 5, windowSec: 60 * 60 },
  /** Picture uploads, per user. */
  uploads: { max: 60, windowSec: 10 * 60 },
  /** Ticket check-ins and check-outs, per user. */
  checkIn: { max: 30, windowSec: 10 * 60 },
  /** Public pages with no session (a quote link, a tenant's site), per IP. */
  publicPage: { max: 120, windowSec: 60 },
  /** Every other signed-in POST / PUT / PATCH / DELETE, per session. */
  mutation: { max: 300, windowSec: 10 * 60 },
} as const

export type RateLimitName = keyof typeof RATE_LIMITS
