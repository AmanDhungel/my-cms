import type { Metadata } from "next"

import { SectionsPanel } from "@/components/dashboard/modules/sections-panel"
import { SettingsView } from "@/components/dashboard/settings/settings-view"
import { requirePageRole } from "@/lib/auth/page-guards"
import { connectToDatabase } from "@/lib/mongodb"
import { uploadsConfigured } from "@/lib/s3"
import { rememberedWorkspace } from "@/lib/auth/membership"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import { resolveModules } from "@/lib/modules"
import { Business, toBusinessDTO } from "@/models/business"
import { Invite } from "@/models/invite"
import { User, toUserDTO } from "@/models/user"

export const metadata: Metadata = { title: "Organization settings · EMS" }

export default async function SettingsPage() {
  const viewer = await requirePageRole("owner", "supervisor")

  await connectToDatabase()

  const [business, me, members, pendingInvites] = await Promise.all([
    (rememberedWorkspace(viewer) ?? Business.findById(viewer.businessId).orFail()),
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
      // So the logo picker says storage is unavailable rather than failing.
      uploads={uploadsConfigured()}
      // Which sidebar sections the workspace uses: the owner or a super
      // admin may change it; a supervisor just sees the result.
      sections={
        viewer.role === "owner" || isSuperAdmin(viewer.email) ? (
          <SectionsPanel
            role={viewer.role}
            initial={
              business.modulesConfiguredAt
                ? resolveModules(business.enabledModules)
                : null
            }
          />
        ) : null
      }
    />
  )
}
