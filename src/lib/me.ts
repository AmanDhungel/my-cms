import type { SessionUser } from "@/lib/auth/guards"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { UPLOAD_PURPOSES_BY_ROLE } from "@/lib/auth/upload-purposes"
import { connectToDatabase } from "@/lib/mongodb"
import { dayKeyInZone } from "@/lib/time"
import { restsOn, shiftOn } from "@/lib/week-server"
import { getWorkspace } from "@/lib/workspace"
import { toBusinessDTO, type BusinessDTO } from "@/models/business"
import { User, toUserDTO, type UserDTO } from "@/models/user"

/**
 * Who is signed in, and the workspace facts every screen needs — the data
 * the web's dashboard layout and pages load server-side
 * (src/app/dashboard/layout.tsx:32-58, src/app/dashboard/page.tsx:38-47,
 * src/app/dashboard/profile/page.tsx:17-24), as one read for the app.
 */
export type MeDTO = {
  user: UserDTO
  /** Whether this address administers the deployment (the admin area stays web-only). */
  superAdmin: boolean
  /** BusinessDTO (logo already a served / CDN URL), plus today's day key in its zone. */
  business: BusinessDTO & { today: string }
  /** The hours that apply today: their own week, else the workspace's, else their shift. */
  shift: { day: string; resting: boolean; hours: string | null }
  permissions: {
    isOwner: boolean
    /** Record deletes are the owner's alone (lib/auth/permissions.ts). */
    deleteRecords: boolean
    /** Tickets, projects, bills, inventory, maintenance, operations, schedules. */
    manageWork: boolean
    /** Approve / reject requests. */
    decideRequests: boolean
    /** Invite, edit and remove members. */
    manageTeam: boolean
    /** Payments, accounts, expenses beyond stock, party ledgers, finance reports, the activity log. */
    seeMoney: boolean
    editSettings: boolean
    /** Ticket check-in / check-out and raising requests. */
    checkIn: boolean
    raiseRequests: boolean
    /** Upload purposes this role may use (POST /api/uploads). */
    uploadPurposes: readonly string[]
  }
}

export async function buildMe(viewer: SessionUser): Promise<MeDTO> {
  await connectToDatabase()
  const [member, business] = await Promise.all([
    User.findById(viewer.id).orFail(),
    getWorkspace(viewer),
  ])

  const day = dayKeyInZone(new Date(), business.timeZone)
  const resting = restsOn(day, member, business)
  const role = member.role
  const owner = role === "owner"
  const crew = role === "employee" || role === "supervisor"

  return {
    user: toUserDTO(member),
    superAdmin: isSuperAdmin(member.email),
    business: { ...toBusinessDTO(business), today: day },
    shift: { day, resting, hours: resting ? null : shiftOn(day, member, business) },
    permissions: {
      isOwner: owner,
      deleteRecords: owner,
      manageWork: role !== "employee",
      decideRequests: owner,
      manageTeam: owner,
      seeMoney: owner,
      editSettings: owner,
      checkIn: crew,
      raiseRequests: crew,
      uploadPurposes: UPLOAD_PURPOSES_BY_ROLE[role],
    },
  }
}
