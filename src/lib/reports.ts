/**
 * Every report the workspace can run, in one place.
 *
 * The registry is client-safe on purpose: the sidebar, the category hubs, the
 * dynamic page and the API all read the same list, so a report can never
 * exist in the nav without a route behind it, or the other way round.
 */

export const REPORT_GROUPS = [
  "sales",
  "inventory",
  "finance",
  "employee",
] as const
export type ReportGroup = (typeof REPORT_GROUPS)[number]

/** Which controls a report's filter bar puts up. The range is universal. */
export type ReportFilter = "employee" | "customer" | "category" | "payment"

export type ReportDef = {
  slug: string
  group: ReportGroup
  title: string
  subtitle: string
  filters: ReportFilter[]
  /**
   * "ready" runs against real data. "blocked" has nothing behind it yet and
   * says so instead of inventing numbers. "partial" works but only sees part
   * of the picture, and carries a notice saying which part.
   */
  status: "ready" | "partial" | "blocked"
  /** What is missing, for a blocked or partial report to explain itself. */
  missing?: string
  /** What you would have to start recording to unblock it. */
  unlock?: string[]
}

export const GROUP_COPY: Record<
  ReportGroup,
  { title: string; short: string; subtitle: string; href: string }
> = {
  sales: {
    title: "Sales reports",
    short: "Sales",
    subtitle: "What you sold, to whom, and by whose hand.",
    href: "/dashboard/reports/sales",
  },
  inventory: {
    title: "Inventory reports",
    short: "Inventory",
    subtitle: "What is on the shelf, what is running out, and what moves.",
    href: "/dashboard/reports/inventory",
  },
  finance: {
    title: "Finance reports",
    short: "Finance",
    subtitle: "Money in, money out, and what is still owed either way.",
    href: "/dashboard/reports/finance",
  },
  employee: {
    title: "Employee reports",
    short: "Employee",
    subtitle: "Who turned up, who was away, and what they got done.",
    href: "/dashboard/reports/employee",
  },
}

export const REPORTS: ReportDef[] = [
  // ---- sales -------------------------------------------------------------
  {
    slug: "daily-sales",
    group: "sales",
    title: "Daily sales",
    subtitle: "Every day you raised a bill, with what it came to.",
    filters: ["employee", "payment"],
    status: "ready",
  },
  {
    slug: "monthly-sales",
    group: "sales",
    title: "Monthly sales",
    subtitle: "The same, rolled up by month.",
    filters: ["employee", "payment"],
    status: "ready",
  },
  {
    slug: "sales-by-employee",
    group: "sales",
    title: "Sales by employee",
    subtitle: "Who raised what, and how much it was worth.",
    filters: ["payment"],
    status: "ready",
  },
  {
    slug: "sales-by-product",
    group: "sales",
    title: "Sales by product",
    subtitle: "Every line item sold, by quantity and by value.",
    filters: ["category"],
    status: "ready",
  },
  {
    slug: "sales-by-customer",
    group: "sales",
    title: "Sales by customer",
    subtitle: "What each customer bought, paid and still owes.",
    filters: ["payment"],
    status: "ready",
  },
  {
    slug: "sales-by-category",
    group: "sales",
    title: "Sales by category",
    subtitle: "Which parts of the catalogue earn their shelf space.",
    filters: [],
    status: "ready",
  },

  // ---- inventory ---------------------------------------------------------
  {
    slug: "current-stock",
    group: "inventory",
    title: "Current stock",
    subtitle: "Everything on the shelf as it stands right now.",
    filters: ["category"],
    status: "ready",
  },
  {
    slug: "low-stock",
    group: "inventory",
    title: "Low stock",
    subtitle: "Items at or below the level you set for them.",
    filters: ["category"],
    status: "ready",
  },
  {
    slug: "stock-valuation",
    group: "inventory",
    title: "Stock valuation",
    subtitle: "What the shelf is worth, at what you sell for.",
    filters: ["category"],
    status: "partial",
    missing:
      "Valued at your selling price, not what you paid — items carry no cost price, so this is retail value rather than the money tied up in stock.",
    unlock: ["A cost price on each inventory item"],
  },
  {
    slug: "stock-movement",
    group: "inventory",
    title: "Stock movement",
    subtitle: "What left the shelf, and on which bill.",
    filters: ["category"],
    status: "partial",
    missing:
      "Only what went out is here. Stock coming in isn't recorded anywhere — items are edited in place rather than received against a document — so this is half the ledger.",
    unlock: ["A goods-received or purchase record", "Logged stock adjustments"],
  },
  {
    slug: "damaged-stock",
    group: "inventory",
    title: "Damaged stock",
    subtitle: "Write-offs, breakages and shrinkage.",
    filters: [],
    status: "blocked",
    missing:
      "Nothing in EMS records a breakage. Stock only ever leaves on a bill, so damage is currently indistinguishable from a sale that was never billed.",
    unlock: [
      "A write-off form on an inventory item (quantity, reason, who saw it)",
      "A reason code so damage, theft and expiry can be told apart",
    ],
  },
  {
    slug: "fast-moving",
    group: "inventory",
    title: "Fast-moving products",
    subtitle: "What sells quickest over the window you pick.",
    filters: ["category"],
    status: "ready",
  },
  {
    slug: "slow-moving",
    group: "inventory",
    title: "Slow-moving products",
    subtitle: "What is sitting still — including what never sold at all.",
    filters: ["category"],
    status: "ready",
  },

  // ---- finance -----------------------------------------------------------
  {
    slug: "revenue",
    group: "finance",
    title: "Revenue",
    subtitle: "What you billed, month by month, net of VAT and discounts.",
    filters: ["payment"],
    status: "ready",
  },
  {
    slug: "expenses",
    group: "finance",
    title: "Expenses",
    subtitle: "What the business spent, by what it was spent on.",
    filters: [],
    status: "ready",
  },
  {
    slug: "profit",
    group: "finance",
    title: "Profit",
    subtitle: "Revenue, less what the goods cost, less what the month cost.",
    filters: [],
    status: "ready",
  },
  {
    slug: "receivables",
    group: "finance",
    title: "Outstanding receivables",
    subtitle: "Bills raised and not yet settled, oldest first.",
    filters: ["customer"],
    status: "ready",
  },
  {
    slug: "payables",
    group: "finance",
    title: "Outstanding payables",
    subtitle: "What you still owe your suppliers.",
    filters: [],
    status: "blocked",
    missing:
      "EMS records payments you have already made, but nothing records a bill a supplier has sent you — so there is no balance to be outstanding against.",
    unlock: [
      "A supplier record, alongside customers",
      "A purchase bill, so a payment out can be set against what was owed",
    ],
  },
  {
    slug: "customer-payments",
    group: "finance",
    title: "Customer payment history",
    subtitle: "Every instalment received, and what it was against.",
    filters: ["customer"],
    status: "ready",
  },
  {
    slug: "supplier-payments",
    group: "finance",
    title: "Supplier payment history",
    subtitle: "Every payment made out, by party.",
    filters: [],
    status: "ready",
  },
  {
    slug: "cash-flow",
    group: "finance",
    title: "Cash flow",
    subtitle: "Money in against money out, month by month.",
    filters: [],
    status: "ready",
  },

  // ---- employee ----------------------------------------------------------
  {
    slug: "attendance-report",
    group: "employee",
    title: "Attendance",
    subtitle: "Days worked, lateness and absence across the crew.",
    filters: ["employee"],
    status: "ready",
  },
  {
    slug: "leave-report",
    group: "employee",
    title: "Leave",
    subtitle: "Leave asked for, granted and refused.",
    filters: ["employee"],
    status: "ready",
  },
  {
    slug: "payroll",
    group: "employee",
    title: "Payroll",
    subtitle: "What each person is owed for the period.",
    filters: ["employee"],
    status: "blocked",
    missing:
      "Nobody in EMS has a wage. Attendance knows the hours, but without a rate — and without knowing whether you pay monthly, daily or hourly — there is no sum to do.",
    unlock: [
      "A pay rate on each person, and whether it is monthly, daily or hourly",
      "Overtime and deduction rules, if they apply",
      "Advances already taken, to set against the total",
    ],
  },
  {
    slug: "employee-activity",
    group: "employee",
    title: "Employee performance",
    subtitle: "Tasks finished, sites visited, bills raised.",
    filters: ["employee"],
    status: "ready",
  },
]

export const REPORT_BY_SLUG = new Map(REPORTS.map((one) => [one.slug, one]))

export function reportsIn(group: ReportGroup) {
  return REPORTS.filter((one) => one.group === group)
}

export function reportHref(slug: string) {
  return `/dashboard/reports/${slug}`
}

/** A column of a report's table. Numbers right-align and get totalled. */
export type ReportColumn = {
  key: string
  label: string
  align?: "left" | "right"
  /** money renders with two decimals and a thousands separator. */
  format?: "text" | "number" | "money" | "day" | "month"
}

/**
 * A chart, computed server-side alongside the table.
 *
 * The values are precomputed rather than pointed at row keys, so a chart can
 * group differently from the table it sits above — daily movement out of a
 * per-line stock report, ageing buckets out of a per-bill receivables list.
 */
export type ReportChartData = {
  /** "bar" is horizontal (ranking); "column" is vertical (over time). */
  kind: "bar" | "column"
  labels: string[]
  series: { label: string; values: number[] }[]
  format: "money" | "number"
  caption?: string
}

export type ReportPayload = {
  slug: string
  columns: ReportColumn[]
  rows: Record<string, string | number | null>[]
  /** Rendered under the table; already formatted by the server. */
  totals: { label: string; value: string }[]
  /** Big numbers above it. */
  stats: { label: string; value: string; accent?: boolean }[]
  chart?: ReportChartData
  note?: string
}
