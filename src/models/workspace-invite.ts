import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

/** Two weeks — longer than a crew invite, since a business takes longer to start. */
export const WORKSPACE_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * A super admin's permission for one new workspace to exist. Without one of
 * these there is no way to register at all: the sign-up form has nothing to
 * post to, and /api/register refuses anything that doesn't carry a live token.
 */
const workspaceInviteSchema = new Schema(
  {
    /**
     * When set, only this address may use the link. Left empty the link is
     * still single-use, but whoever opens it picks their own address.
     */
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    /** Pre-fills the workspace name on the form; the owner can change it. */
    businessName: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 500 },
    /**
     * Only the hash is stored. The raw token exists once, in the link handed
     * over — a database leak can't be replayed into a workspace.
     */
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    /** Set the moment it is spent, which is what makes it single-use. */
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    business: { type: Schema.Types.ObjectId, ref: "Business" },
    revokedAt: { type: Date },
  },
  { timestamps: true }
)

export type WorkspaceInviteDocument = InferSchemaType<
  typeof workspaceInviteSchema
>

export const WorkspaceInvite: Model<WorkspaceInviteDocument> =
  (models.WorkspaceInvite as Model<WorkspaceInviteDocument>) ??
  model<WorkspaceInviteDocument>("WorkspaceInvite", workspaceInviteSchema)

export type WorkspaceInviteState =
  | "pending"
  | "used"
  | "revoked"
  | "expired"

export type WorkspaceInviteDTO = {
  id: string
  email: string | null
  businessName: string | null
  note: string | null
  state: WorkspaceInviteState
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
  /** The workspace it turned into, once it has been spent. */
  workspace: string | null
}

export function inviteState(
  invite: HydratedDocument<WorkspaceInviteDocument>
): WorkspaceInviteState {
  if (invite.acceptedAt) return "used"
  if (invite.revokedAt) return "revoked"
  if (invite.expiresAt.getTime() < Date.now()) return "expired"
  return "pending"
}

export function toWorkspaceInviteDTO(
  invite: HydratedDocument<WorkspaceInviteDocument>,
  workspace?: string | null
): WorkspaceInviteDTO {
  return {
    id: String(invite._id),
    email: invite.email ?? null,
    businessName: invite.businessName ?? null,
    note: invite.note ?? null,
    state: inviteState(invite),
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: (invite.createdAt as Date).toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
    workspace: workspace ?? null,
  }
}
