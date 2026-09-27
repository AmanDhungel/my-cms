import { z } from "zod"

import { isSafeHttpUrl, UNSAFE_URL_MESSAGE } from "@/lib/security/safe-url"

/** Zod: a required safe http(s) URL (lib/security/safe-url.ts). */
export const safeUrl = (max = 600) =>
  z.string().trim().max(max).refine(isSafeHttpUrl, UNSAFE_URL_MESSAGE)
