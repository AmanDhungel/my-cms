import type { Metadata } from "next"

import { SettingsView } from "@/components/dashboard/settings/settings-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Business, toBusinessDTO } from "@/models/business"
import { Invite } from "@/models/invite"
import { User, toUserDTO } from "@/models/user"

export const metadata: Metadata = { title: "Organization settings · EMS" }

export default async function SettingsPage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()

  const [business, me, members, pendingInvites] = await Promise.all([
    Business.findById(viewer.businessId).orFail(),
    User.findById(viewer.id).orFail(),
    User.countDocuments({ business: viewer.businessId }),
    Invite.countDocuments({
      business: viewer.businessId,
      acceptedAt: { $exists: false },
    }),
  ])

  return (
    <SettingsView
      business={toBusinessDTO(business)}
      me={toUserDTO(me)}
      canEdit={viewer.role === "owner"}
      stats={{ members, pendingInvites }}
    />
  )
}
