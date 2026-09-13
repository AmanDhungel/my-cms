import type { PipelineStage } from "mongoose"

import { handleApiError, ok } from "@/lib/api-response"
import { requireSuperAdmin } from "@/lib/auth/guards"
import { isSuperAdmin } from "@/lib/auth/super-admin"
import type {
  AdminBusiness,
  AdminProject,
  AdminUser,
} from "@/lib/admin"
import { connectToDatabase } from "@/lib/mongodb"
import { Bill } from "@/models/bill"
import { Business } from "@/models/business"
import { InventoryItem } from "@/models/inventory-item"
import { Project } from "@/models/project"
import { Task } from "@/models/task"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * Everything the admin area lists, in one read. It is a small, whole-system
 * view rather than a per-workspace one, so it is fetched together and sliced
 * on the page.
 */
export async function GET() {
  try {
    await requireSuperAdmin()
    await connectToDatabase()

    const [businesses, users, projects] = await Promise.all([
      Business.find().sort({ createdAt: -1 }).limit(500),
      User.find().sort({ createdAt: -1 }).limit(2000),
      Project.find().sort({ createdAt: -1 }).limit(2000),
    ])

    // One grouped query per collection rather than a count per row.
    const [byUser, byProject, byTask, byBill, byItem, byProjectTask] =
      await Promise.all([
        User.aggregate<Counted>(groupBy("business")).then(asMap),
        Project.aggregate<Counted>(groupBy("business")).then(asMap),
        Task.aggregate<Counted>(groupBy("business")).then(asMap),
        Bill.aggregate<Counted>(groupBy("business")).then(asMap),
        InventoryItem.aggregate<Counted>(groupBy("business")).then(asMap),
        Task.aggregate<Counted>(groupBy("project")).then(asMap),
      ])

    const owners = new Map(
      users.map((user) => [String(user._id), { name: user.name, email: user.email }])
    )
    const workspaces = new Map(
      businesses.map((business) => [
        String(business._id),
        {
          id: String(business._id),
          name: business.name,
          blockedAt: business.blockedAt ? business.blockedAt.toISOString() : null,
        },
      ])
    )

    return ok({
      businesses: businesses.map((business): AdminBusiness => {
        const key = String(business._id)
        return {
          id: key,
          name: business.name,
          crewSize: business.crewSize,
          timeZone: business.timeZone,
          blockedAt: business.blockedAt ? business.blockedAt.toISOString() : null,
          createdAt: (business.createdAt as Date).toISOString(),
          owner: owners.get(String(business.owner)) ?? null,
          counts: {
            users: byUser.get(key) ?? 0,
            projects: byProject.get(key) ?? 0,
            tasks: byTask.get(key) ?? 0,
            bills: byBill.get(key) ?? 0,
            items: byItem.get(key) ?? 0,
          },
        }
      }),

      users: users.map((user): AdminUser => {
        const workspace = workspaces.get(String(user.business)) ?? null
        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null,
          // Shown so the one account that can't be blocked is obvious.
          superAdmin: isSuperAdmin(user.email),
          createdAt: (user.createdAt as Date).toISOString(),
          business: workspace,
        }
      }),

      projects: projects.map((project): AdminProject => {
        const workspace = workspaces.get(String(project.business))
        return {
          id: String(project._id),
          name: project.name,
          site: project.site ?? null,
          status: project.status,
          createdAt: (project.createdAt as Date).toISOString(),
          business: workspace
            ? { id: workspace.id, name: workspace.name }
            : null,
          tasks: byProjectTask.get(String(project._id)) ?? 0,
        }
      }),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

type Counted = { _id: unknown; n: number }

/** Counts the rows behind each distinct value of one field. */
function groupBy(field: string): PipelineStage[] {
  return [{ $group: { _id: `$${field}`, n: { $sum: 1 } } }]
}

/** Ids come back as ObjectIds; the lookups are all keyed by string. */
const asMap = (rows: Counted[]) =>
  new Map(rows.map((row) => [String(row._id), row.n]))
