/**
 * The expense taxonomy as it reads on screen.
 *
 * Client-safe on purpose: no model is imported here, because importing a
 * *value* from a model file drags mongoose into the browser bundle. The
 * server-side arithmetic lives in `expenses-server.ts`.
 */
import { EXPENSE_KINDS, type ExpenseKind } from "@/lib/work-constants"

export { EXPENSE_KINDS, type ExpenseKind }

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  stock: "Stock purchase",
  salary: "Salary & wages",
  commission: "Commission & bonus",
  contractor: "Contractor & labour",
  rent: "Rent & lease",
  utilities: "Electricity, water & internet",
  fuel: "Fuel",
  vehicle: "Vehicle & running costs",
  tools: "Tools & equipment",
  repairs: "Repairs & maintenance",
  office: "Office & stationery",
  marketing: "Marketing & advertising",
  travel: "Travel & lodging",
  food: "Staff food & refreshments",
  training: "Training",
  professional: "Professional fees",
  insurance: "Insurance",
  tax: "Tax & government fees",
  bank: "Bank charges & interest",
  software: "Software & subscriptions",
  other: "Other",
}

/** Shorter, for a table column or a filter chip where the full label won't fit. */
export const EXPENSE_KIND_SHORT: Record<ExpenseKind, string> = {
  stock: "Stock",
  salary: "Salary",
  commission: "Commission",
  contractor: "Contractor",
  rent: "Rent",
  utilities: "Utilities",
  fuel: "Fuel",
  vehicle: "Vehicle",
  tools: "Tools",
  repairs: "Repairs",
  office: "Office",
  marketing: "Marketing",
  travel: "Travel",
  food: "Food",
  training: "Training",
  professional: "Professional",
  insurance: "Insurance",
  tax: "Tax",
  bank: "Bank",
  software: "Software",
  other: "Other",
}

/**
 * The kinds grouped for the picker. Twenty-one options in one flat list is a
 * scroll; five headings is a glance.
 */
export const EXPENSE_KIND_GROUPS: { label: string; kinds: ExpenseKind[] }[] = [
  { label: "Stock", kinds: ["stock"] },
  { label: "People", kinds: ["salary", "commission", "contractor", "training"] },
  { label: "Premises", kinds: ["rent", "utilities", "office", "insurance"] },
  {
    label: "Running the work",
    kinds: ["fuel", "vehicle", "tools", "repairs", "travel", "food"],
  },
  {
    label: "Business costs",
    kinds: ["marketing", "professional", "tax", "bank", "software", "other"],
  },
]

/**
 * What a supervisor may see and record.
 *
 * A supervisor buys the stock, so they need this one; what the business pays
 * in salaries, rent or tax is the owner's alone. The API enforces it — this
 * list is only so the UI doesn't offer what the server will refuse.
 */
export const SUPERVISOR_KINDS: readonly ExpenseKind[] = ["stock"]

export function kindLabel(kind: string) {
  return EXPENSE_KIND_LABELS[kind as ExpenseKind] ?? kind
}

export function shortKindLabel(kind: string) {
  return EXPENSE_KIND_SHORT[kind as ExpenseKind] ?? kind
}

/** Whether this kind names a person on the payroll rather than a company. */
export function isPayroll(kind: string) {
  return kind === "salary" || kind === "commission"
}

/** Only a stock purchase carries lines and moves the shelf. */
export function movesStock(kind: string) {
  return kind === "stock"
}

/**
 * What to call the other side of the payment, which is not the same word for
 * every kind — "paid to" a vendor, but a landlord, a bank or an employee.
 */
export function payeeLabel(kind: string) {
  if (kind === "stock") return "Vendor"
  if (isPayroll(kind)) return "Employee"
  return "Paid to"
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** A purchase is worth the sum of its lines, never a figure typed beside them. */
export function linesTotal(lines: { qty: number; cost: number }[]) {
  return round2(
    lines.reduce((sum, line) => sum + (line.qty || 0) * (line.cost || 0), 0)
  )
}
