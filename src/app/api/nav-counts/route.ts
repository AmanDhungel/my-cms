import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { connectToDatabase } from "@/lib/mongodb"
import { Bill } from "@/models/bill"
import { Customer } from "@/models/customer"
import { Expense } from "@/models/expense"
import { InventoryItem } from "@/models/inventory-item"
import { Invite } from "@/models/invite"
import { MaintenanceItem } from "@/models/maintenance"
import { Notification } from "@/models/notification"
import { Payment } from "@/models/payment"
import { Project } from "@/models/project"
import { WorkRequest } from "@/models/request"
import { Ticket } from "@/models/ticket"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * The owner / supervisor navigation badges, counted with exactly the
 * queries the dashboard layout runs server-side
 * (src/app/dashboard/layout.tsx:60-103).
 */
export async function GET() {
  try {
    const viewer = await requireRole("owner", "supervisor")
    await connectToDatabase()
    const business = viewer.businessId

    const [
      people,
      pendingInvites,
      projects,
      tickets,
      inventory,
      sales,
      customers,
      payments,
      expenses,
      maintenance,
      approvals,
      unread,
    ] = await Promise.all([
      User.countDocuments({ business, status: "active" }),
      Invite.countDocuments({ business, acceptedAt: { $exists: false } }),
      Project.countDocuments({ business, status: "active" }),
      Ticket.countDocuments({ business, status: { $nin: ["done", "cancelled"] } }),
      InventoryItem.countDocuments({ business }),
      Bill.countDocuments({ business, status: "issued" }),
      Customer.countDocuments({ business }),
      Payment.countDocuments({ business }),
      Expense.countDocuments({ business }),
      MaintenanceItem.countDocuments({ business, status: { $nin: ["returned", "scrapped"] } }),
      WorkRequest.countDocuments({ business, status: "pending" }),
      Notification.countDocuments({ business, user: viewer.id, readAt: { $exists: false } }),
    ])

    return ok({
      counts: {
        people,
        pendingInvites,
        projects,
        tickets,
        inventory,
        sales,
        customers,
        payments,
        expenses,
        maintenance,
        approvals,
        unread,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
