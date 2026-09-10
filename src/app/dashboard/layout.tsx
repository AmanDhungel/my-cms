import { redirect } from "next/navigation";

import { EmployeeShell } from "@/components/dashboard/employee-shell";
import { OwnerShell } from "@/components/dashboard/owner-shell";
import { loadViewer } from "@/lib/auth/page-guards";
import { Bill } from "@/models/bill";
import { Business } from "@/models/business";
import { InventoryItem } from "@/models/inventory-item";
import { Invite } from "@/models/invite";
import { Notification } from "@/models/notification";
import { Project } from "@/models/project";
import { WorkRequest } from "@/models/request";
import { Task } from "@/models/task";
import { User } from "@/models/user";

/** Sessions are per-request; nothing under /dashboard may be cached. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // `proxy.ts` already blocks anonymous requests; `loadViewer` is the second
  // gate, and the one that re-checks membership against the database so a
  // still-valid token can't outlive being removed.
  const me = await loadViewer();

  const business = await Business.findById(me.businessId);

  if (!business) {
    redirect("/login");
  }

  const viewer = {
    name: me.name,
    email: me.email,
    role: me.role,
    businessName: business.name,
  };

  if (me.role === "employee") {
    const shift = await User.findById(me.id).select("shift");
    return (
      <EmployeeShell viewer={{ ...viewer, shift: shift?.shift ?? null }}>
        {children}
      </EmployeeShell>
    );
  }

  const [
    people,
    pendingInvites,
    projects,
    tasks,
    inventory,
    sales,
    approvals,
    unread,
  ] = await Promise.all([
    User.countDocuments({ business: business._id, status: "active" }),
    Invite.countDocuments({
      business: business._id,
      acceptedAt: { $exists: false },
    }),
    Project.countDocuments({ business: business._id, status: "active" }),
    Task.countDocuments({
      business: business._id,
      status: { $nin: ["done", "cancelled"] },
    }),
    InventoryItem.countDocuments({ business: business._id }),
    Bill.countDocuments({ business: business._id, status: "issued" }),
    WorkRequest.countDocuments({
      business: business._id,
      status: "pending",
    }),
    Notification.countDocuments({
      user: me.id,
      readAt: { $exists: false },
    }),
  ]);

  return (
    <OwnerShell
      viewer={viewer}
      counts={{
        people,
        pendingInvites,
        projects,
        tasks,
        inventory,
        sales,
        approvals,
        unread,
      }}>
      {children}
    </OwnerShell>
  );
}
