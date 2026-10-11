import { z } from "zod"

import { MODULE_KEYS } from "@/lib/modules"

/**
 * The sections a workspace uses. "Use everything" sends all four; a custom
 * choice needs at least one, since a workspace with no sections would leave
 * nothing but settings.
 */
export const modulesSchema = z.object({
  modules: z
    .array(z.enum(MODULE_KEYS))
    .min(1, "Pick at least one section")
    .transform((list) => MODULE_KEYS.filter((key) => list.includes(key))),
})

export type ModulesInput = z.input<typeof modulesSchema>
