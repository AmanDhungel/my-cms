import type { Metadata } from "next"

import { PeopleView } from "@/components/dashboard/people/people-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Invite, toInviteDTO } from "@/models/invite"
import { User, toUserDTO } from "@/models/user"

export const metadata: Metadata = { title: "People · EMS" }

export default async function PeoplePage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()

  const [members, invites] = await Promise.all([
    User.find({ business: viewer.businessId }).sort({ createdAt: 1 }),
    Invite.find({
      business: viewer.businessId,
      acceptedAt: { $exists: false },
    }).sort({ createdAt: -1 }),
  ])

  return (
    <PeopleView
      canInvite={viewer.role === "owner"}
      viewerId={viewer.id}
      members={members.map(toUserDTO)}
      invites={invites.map(toInviteDTO)}
    />
  )
}
