/**
 * Which parts of the app a workspace has switched on.
 *
 * A workspace picks whole sidebar sections, not single pages: Workspace,
 * Operations, Sales & stock and Reports & analytics. Dashboard, Notifications
 * and Organization settings belong to no section and are always there.
 *
 * Nothing is stored for a workspace that has never chosen, and "nothing
 * stored" means every section is on — exactly how the app behaved before
 * sections existed, so no record needs a backfill.
 *
 * This is a display preference. It shapes the sidebar, the dashboard and a
 * "turned off" screen on the pages of a hidden section; it never refuses an
 * API call, so the mobile app and every existing link keep working.
 *
 * Pure data and string work with no React or database import, so the shells,
 * the server, the settings page and the unit tests all read the same rules.
 */

export const MODULE_KEYS = ["workspace", "operations", "sales_stock", "reports"] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

/** The roles that see the owner/supervisor sidebar. */
export type NavRole = "owner" | "supervisor"

export type NavItemConfig = {
  href: string
  label: string
  /** Only these roles see the link. Absent: both. */
  roles?: readonly NavRole[]
  /** Shown whatever the workspace has switched off (Dashboard). */
  alwaysOn?: boolean
}

export type NavSectionConfig = {
  /** `null` is the Account group, which can't be switched off. */
  module: ModuleKey | null
  label: string
  /** One line for the section chooser. */
  blurb: string
  items: readonly NavItemConfig[]
}

const OWNER_ONLY = ["owner"] as const

/**
 * The owner/supervisor sidebar, in order. The shell adds icons and counts by
 * `href`; this is the single list the chooser, the route check and the
 * sidebar filter all derive from.
 */
export const NAV_SECTIONS: readonly NavSectionConfig[] = [
  {
    module: "workspace",
    label: "Workspace",
    blurb: "Projects, tickets, your crew and their attendance.",
    items: [
      { href: "/dashboard", label: "Dashboard", alwaysOn: true },
      { href: "/dashboard/projects", label: "Projects" },
      { href: "/dashboard/tickets", label: "All tickets" },
      { href: "/dashboard/people", label: "People" },
      { href: "/dashboard/attendance", label: "Attendance" },
      { href: "/dashboard/approvals", label: "Approvals" },
    ],
  },
  {
    module: "operations",
    label: "Operations",
    blurb: "Everything with a date on it that isn't a ticket.",
    items: [
      { href: "/dashboard/calendar", label: "Calendar" },
      { href: "/dashboard/meetings", label: "Meetings" },
      { href: "/dashboard/installations", label: "Installation dates" },
      { href: "/dashboard/follow-ups", label: "Follow-ups" },
      { href: "/dashboard/schedules", label: "Employee schedules" },
      { href: "/dashboard/deadlines", label: "Important deadlines" },
      { href: "/dashboard/maintenance", label: "Maintenance" },
    ],
  },
  {
    module: "sales_stock",
    label: "Sales & stock",
    blurb: "Stock, bills, parties and the money around them.",
    items: [
      { href: "/dashboard/inventory", label: "Inventory" },
      { href: "/dashboard/sales", label: "Sales" },
      { href: "/dashboard/customers", label: "Parties" },
      // What the business pays out is the owner's business alone.
      { href: "/dashboard/expenses", label: "Expenses", roles: OWNER_ONLY },
      { href: "/dashboard/payments", label: "Payments", roles: OWNER_ONLY },
    ],
  },
  {
    module: "reports",
    label: "Reports & analytics",
    blurb: "Charts and tables across sales, stock, money and people.",
    items: [
      { href: "/dashboard/reports/sales", label: "Sales reports" },
      { href: "/dashboard/reports/inventory", label: "Inventory reports" },
      { href: "/dashboard/reports/finance", label: "Finance reports", roles: OWNER_ONLY },
      { href: "/dashboard/reports/employee", label: "Employee reports" },
    ],
  },
  {
    module: null,
    label: "Account",
    blurb: "",
    items: [
      { href: "/dashboard/notifications", label: "Notifications" },
      { href: "/dashboard/settings", label: "Organization settings" },
    ],
  },
]

export type ModuleState = Record<ModuleKey, boolean>

export const ALL_MODULES_ON: ModuleState = {
  workspace: true,
  operations: true,
  sales_stock: true,
  reports: true,
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value)
}

/**
 * What is on for a workspace, from what is stored.
 *
 * Nothing stored (a workspace that has never chosen) is everything on. So is
 * a stored list with no known section in it: the API never writes one, and a
 * workspace with no sections at all would be a broken one, not a choice.
 */
export function resolveModules(stored: readonly unknown[] | null | undefined): ModuleState {
  if (!stored) return { ...ALL_MODULES_ON }
  const known = stored.filter(isModuleKey)
  if (known.length === 0) return { ...ALL_MODULES_ON }
  return {
    workspace: known.includes("workspace"),
    operations: known.includes("operations"),
    sales_stock: known.includes("sales_stock"),
    reports: known.includes("reports"),
  }
}

/** The stored form of a state: the keys that are on, in the canonical order. */
export function enabledList(state: ModuleState): ModuleKey[] {
  return MODULE_KEYS.filter((key) => state[key])
}

/**
 * The section a dashboard page belongs to, or null for a page no switch
 * hides (Dashboard itself, Notifications, settings, the website editor, the
 * crew's own pages).
 */
export function moduleForPath(pathname: string): ModuleKey | null {
  for (const section of NAV_SECTIONS) {
    if (!section.module) continue
    for (const item of section.items) {
      if (item.alwaysOn) continue
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return section.module
      }
    }
  }
  // A report page reached from a hub, e.g. /dashboard/reports/cash-flow.
  if (pathname === "/dashboard/reports" || pathname.startsWith("/dashboard/reports/")) {
    return "reports"
  }
  return null
}

/**
 * Pages that stay reachable even when their section is off.
 *
 * People: the "Invite someone" card under the sidebar is how anyone joins a
 * workspace, so it has to keep opening the invite form whatever is switched
 * off. The People link itself still leaves the sidebar with its section.
 */
const REACHABLE_WHEN_OFF = ["/dashboard/people"]

/** Whether a page should show the "This section is turned off" screen. */
export function isPathTurnedOff(pathname: string, modules: ModuleState): boolean {
  const key = moduleForPath(pathname)
  if (!key || modules[key]) return false
  return !REACHABLE_WHEN_OFF.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  )
}

export type VisibleSection<T extends NavItemConfig = NavItemConfig> = {
  module: ModuleKey | null
  /** `null` hides the heading: only an always-on link is left of a section that is off. */
  label: string | null
  items: T[]
}

/**
 * The sidebar for one viewer: role rules first (never loosened by a section
 * being on), then the workspace's sections. A section that is off keeps only
 * its always-on links, under no heading; a section left with no links at all
 * is dropped.
 */
export function visibleSections<T extends NavItemConfig>(
  sections: readonly { module: ModuleKey | null; label: string; items: readonly T[] }[],
  options: { role: string; modules: ModuleState }
): VisibleSection<T>[] {
  const result: VisibleSection<T>[] = []
  for (const section of sections) {
    const on = section.module === null || options.modules[section.module]
    const items = section.items.filter(
      (item) =>
        (!item.roles || (item.roles as readonly string[]).includes(options.role)) &&
        (on || item.alwaysOn)
    )
    if (items.length === 0) continue
    result.push({ module: section.module, label: on ? section.label : null, items })
  }
  return result
}

/** The chooser's cards: each section with the pages a given role would get. */
export function chooserSections(role: string) {
  return NAV_SECTIONS.filter(
    (section): section is NavSectionConfig & { module: ModuleKey } => section.module !== null
  ).map((section) => ({
    module: section.module,
    label: section.label,
    blurb: section.blurb,
    pages: section.items
      .filter((item) => !item.alwaysOn && (!item.roles || (item.roles as readonly string[]).includes(role)))
      .map((item) => item.label),
  }))
}
