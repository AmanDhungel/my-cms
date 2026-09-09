import type { Metadata } from "next"

import { PeopleView } from "@/components/dashboard/people/people-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { getWorkspace } from "@/lib/workspace"
import { Invite, toInviteDTO } from "@/models/invite"
import { User, toUserDTO } from "@/models/user"

export const metadata: Metadata = { title: "People · EMS" }

export default async function PeoplePage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()

  const [business, members, invites] = await Promise.all([
    getWorkspace(viewer.businessId),
    // Removed people are listed too, greyed out, so the record of who was
    // here doesn't just vanish from the owner's view.
    User.find({ business: viewer.businessId }).sort({ status: 1, createdAt: 1 }),
    Invite.find({
      business: viewer.businessId,
      acceptedAt: { $exists: false },
    }).sort({ createdAt: -1 }),
  ])

  return (
    <PeopleView
      canManage={viewer.role === "owner"}
      viewerId={viewer.id}
      ownerId={String(business.owner)}
      members={members.map(toUserDTO)}
      invites={invites.map(toInviteDTO)}
    />
  )
}
