import type { NextRequest } from "next/server"
import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { requireSuperAdmin } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { createInviteToken } from "@/models/invite"
import {
  WORKSPACE_INVITE_TTL_MS,
  WorkspaceInvite,
  toWorkspaceInviteDTO,
} from "@/models/workspace-invite"

export const runtime = "nodejs"

const workspaceInviteSchema = z.object({
  /** Optional: leave it out and whoever opens the link picks their address. */
  email: z
    .union([z.literal(""), z.email("That email doesn't look right")])
    .optional(),
  businessName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
})

/**
 * Issues one permission for a new workspace to exist. The raw token is
 * returned exactly once, in the link — only its hash is kept, so a link that
 * isn't copied now can't be recovered later.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    const values = workspaceInviteSchema.parse(await request.json())

    await connectToDatabase()

    const { token, tokenHash } = createInviteToken()

    const invite = await WorkspaceInvite.create({
      email: values.email || undefined,
      businessName: values.businessName || undefined,
      note: values.note || undefined,
      tokenHash,
      invitedBy: admin.id,
      expiresAt: new Date(Date.now() + WORKSPACE_INVITE_TTL_MS),
    })

    return ok(
      {
        invite: toWorkspaceInviteDTO(invite),
        signupUrl: new URL(
          `/signup?invite=${token}`,
          request.nextUrl.origin
        ).toString(),
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
