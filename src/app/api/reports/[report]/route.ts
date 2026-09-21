import type { NextRequest } from "next/server"
import { Types } from "mongoose"

import { HttpError, handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import { money, round2 } from "@/lib/billing"
import { connectToDatabase } from "@/lib/mongodb"
import { paidByBill } from "@/lib/payments"
import { REPORT_BY_SLUG, type ReportPayload } from "@/lib/reports"
import { dayKeyInZone } from "@/lib/time"
import { getWorkspace } from "@/lib/workspace"
import { Attendance } from "@/models/attendance"
import { Bill } from "@/models/bill"
import { CheckIn } from "@/models/check-in"
import { InventoryItem } from "@/models/inventory-item"
import { Payment } from "@/models/payment"
import { WorkRequest } from "@/models/request"
import { Task } from "@/models/task"
import { User } from "@/models/user"

export const runtime = "nodejs"

/**
 * Every report runs through here. One route rather than twenty-odd, because
 * they differ only in the query behind them — the shape they hand back, and
 * therefore the table, the filters and the export, is the same for all.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/reports/[report]">
) {
  try {
    const viewer = await requireRole("owner", "supervisor")
    const { report: slug } = await ctx.params

    const def = REPORT_BY_SLUG.get(slug)
    if (!def) throw new HttpError(404, "There's no such report")

    if (def.status === "blocked") {
      // Nothing to run. The page explains itself from the registry.
      return ok({ slug, blocked: true, missing: def.missing, unlock: def.unlock })
    }

    await connectToDatabase()
    const business = await getWorkspace(viewer.businessId)
    const zone = business.timeZone
    const params = request.nextUrl.searchParams

    const from = asDate(params.get("from"))
    const to = asEndOfDay(params.get("to"))
    const employeeId = asId(params.get("employeeId"))
    const customerId = asId(params.get("customerId"))
    const categoryId = asId(params.get("categoryId"))
    const payment = params.get("payment")

    const scope = { businessId: viewer.businessId, zone, from, to, employeeId, customerId, categoryId, payment }

    const payload = await build(slug, scope)

    return ok({ ...payload, blocked: false, note: def.missing ?? payload.note })
  } catch (error) {
    return handleApiError(error)
  }
}

type Scope = {
  businessId: string
  zone: string
  from: Date | null
  to: Date | null
  employeeId: string | null
  customerId: string | null
  categoryId: string | null
  payment: string | null
}

async function build(slug: string, s: Scope): Promise<ReportPayload> {
  switch (slug) {
    case "daily-sales":
    case "monthly-sales":
      return salesByPeriod(slug === "daily-sales" ? "day" : "month", s)
    case "sales-by-employee":
      return salesByEmployee(s)
    case "sales-by-product":
      return salesByProduct(s)
    case "sales-by-customer":
      return salesByCustomer(s)
    case "sales-by-category":
      return salesByCategory(s)
    case "current-stock":
    case "stock-valuation":
      return currentStock(slug === "stock-valuation", s)
    case "low-stock":
      return lowStock(s)
    case "stock-movement":
      return stockMovement(s)
    case "fast-moving":
    case "slow-moving":
      return movingProducts(slug === "fast-moving", s)
    case "revenue":
      return revenue(s)
    case "expenses":
      return expenses(s)
    case "receivables":
      return receivables(s)
    case "customer-payments":
      return partyPayments("in", s)
    case "supplier-payments":
      return partyPayments("out", s)
    case "cash-flow":
      return cashFlow(s)
    case "attendance-report":
      return attendanceReport(s)
    case "leave-report":
      return leaveReport(s)
    case "employee-activity":
      return employeeActivity(s)
    default:
      throw new HttpError(404, "There's no such report")
  }
}

// ---- shared bill loading -------------------------------------------------

/**
 * The bills a sales report counts. Void ones never count, and a quotation is
 * a price offered rather than a sale, so it is left out too unless the filter
 * asks for it by name.
 */
async function loadBills(s: Scope) {
  const filter: Record<string, unknown> = {
    business: s.businessId,
    status: "issued",
  }

  if (s.from || s.to) {
    filter.createdAt = {
      ...(s.from ? { $gte: s.from } : {}),
      ...(s.to ? { $lte: s.to } : {}),
    }
  }
  if (s.employeeId) filter.issuedBy = s.employeeId
  if (s.customerId) filter.customerRef = s.customerId

  if (s.payment && ["paid", "unpaid", "cheque", "quotation"].includes(s.payment)) {
    filter.payment = s.payment
  } else {
    filter.payment = { $ne: "quotation" }
  }

  const bills = await Bill.find(filter).sort({ createdAt: 1 }).limit(5000)
  const paid = await paidByBill(s.businessId)

  return bills.map((bill) => ({
    doc: bill,
    paid: paid.get(String(bill._id)) ?? 0,
  }))
}

/**
 * What has actually come in against a bill.
 *
 * A bill marked paid by hand carries no instalment record — the money was
 * taken over the counter and never entered on the Payments page — so its own
 * flag is the truth. Reading only the ledger would report every counter sale
 * as still owed.
 */
function receivedOf(bill: { total: number; payment: string }, paid: number) {
  if (bill.payment === "paid") return round2(bill.total)
  if (bill.payment === "quotation") return 0
  return round2(Math.min(paid, bill.total))
}

function dueOf(bill: { total: number; payment: string }, paid: number) {
  if (bill.payment === "quotation") return 0
  return round2(Math.max(0, bill.total - receivedOf(bill, paid)))
}

// ---- sales ---------------------------------------------------------------

async function salesByPeriod(unit: "day" | "month", s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const buckets = new Map<
    string,
    { bills: number; gross: number; discount: number; vat: number; total: number; paid: number }
  >()

  for (const { doc, paid } of bills) {
    const day = dayKeyInZone(doc.createdAt as Date, s.zone)
    const key = unit === "day" ? day : day.slice(0, 7)
    const at = buckets.get(key) ?? {
      bills: 0, gross: 0, discount: 0, vat: 0, total: 0, paid: 0,
    }
    at.bills += 1
    at.gross += doc.subtotal
    at.discount += doc.discountTotal
    at.vat += doc.vatAmount
    at.total += doc.total
    at.paid += receivedOf(doc, paid)
    buckets.set(key, at)
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, at]) => ({
      period: key,
      bills: at.bills,
      gross: round2(at.gross),
      discount: round2(at.discount),
      vat: round2(at.vat),
      total: round2(at.total),
      paid: round2(at.paid),
      due: round2(Math.max(0, at.total - at.paid)),
    }))

  const sum = (k: keyof (typeof rows)[number]) =>
    rows.reduce((n, row) => n + Number(row[k] ?? 0), 0)

  return {
    slug: unit === "day" ? "daily-sales" : "monthly-sales",
    columns: [
      { key: "period", label: unit === "day" ? "Day" : "Month", format: unit === "day" ? "day" : "month" },
      { key: "bills", label: "Bills", align: "right", format: "number" },
      { key: "gross", label: "Gross", align: "right", format: "money" },
      { key: "discount", label: "Discount", align: "right", format: "money" },
      { key: "vat", label: "VAT", align: "right", format: "money" },
      { key: "total", label: "Total", align: "right", format: "money" },
      { key: "paid", label: "Received", align: "right", format: "money" },
      { key: "due", label: "Still owed", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "BILLS", value: String(sum("bills")) },
      { label: "TOTAL", value: money(sum("total")) },
      { label: "RECEIVED", value: money(sum("paid")) },
      { label: "STILL OWED", value: money(sum("due")), accent: sum("due") > 0 },
    ],
    totals: [
      { label: "Total", value: money(sum("total")) },
      { label: "Received", value: money(sum("paid")) },
      { label: "Still owed", value: money(sum("due")) },
    ],
  }
}

async function salesByEmployee(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const people = await User.find({ business: s.businessId }).select("name role")
  const names = new Map(people.map((p) => [String(p._id), p.name]))

  const buckets = new Map<string, { bills: number; total: number; paid: number }>()
  for (const { doc, paid } of bills) {
    const key = String(doc.issuedBy)
    const at = buckets.get(key) ?? { bills: 0, total: 0, paid: 0 }
    at.bills += 1
    at.total += doc.total
    at.paid += receivedOf(doc, paid)
    buckets.set(key, at)
  }

  const rows = [...buckets.entries()]
    .map(([id, at]) => ({
      person: names.get(id) ?? "Someone who has left",
      bills: at.bills,
      total: round2(at.total),
      average: round2(at.total / Math.max(1, at.bills)),
      paid: round2(at.paid),
      due: round2(Math.max(0, at.total - at.paid)),
    }))
    .sort((a, b) => b.total - a.total)

  const total = rows.reduce((n, r) => n + r.total, 0)

  return {
    slug: "sales-by-employee",
    columns: [
      { key: "person", label: "Person" },
      { key: "bills", label: "Bills", align: "right", format: "number" },
      { key: "total", label: "Total", align: "right", format: "money" },
      { key: "average", label: "Average bill", align: "right", format: "money" },
      { key: "paid", label: "Received", align: "right", format: "money" },
      { key: "due", label: "Still owed", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "PEOPLE SELLING", value: String(rows.length) },
      { label: "BILLS", value: String(rows.reduce((n, r) => n + r.bills, 0)) },
      { label: "TOTAL", value: money(total) },
      { label: "BEST", value: rows[0]?.person ?? "—" },
    ],
    totals: [{ label: "Total", value: money(total) }],
  }
}

async function salesByProduct(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const items = await InventoryItem.find({ business: s.businessId })
    .select("name category")
    .populate<{ category: { _id: unknown; name?: string } }>("category", "name")

  const categoryOf = new Map(
    items.map((one) => [String(one._id), one.category?.name ?? "Uncategorised"])
  )
  const inCategory = new Set(
    s.categoryId
      ? items.filter((one) => String(one.category?._id) === s.categoryId).map((one) => String(one._id))
      : []
  )

  const buckets = new Map<
    string,
    { qty: number; revenue: number; bills: number; category: string }
  >()

  for (const { doc } of bills) {
    for (const line of doc.lines) {
      const itemId = line.item ? String(line.item) : ""
      if (s.categoryId && !inCategory.has(itemId)) continue

      const key = itemId || `custom:${line.name.toLowerCase()}`
      const at = buckets.get(key) ?? {
        qty: 0, revenue: 0, bills: 0,
        category: itemId ? (categoryOf.get(itemId) ?? "Uncategorised") : "Typed by hand",
      }
      at.qty += line.qty
      at.revenue += line.price * line.qty * (1 - line.discountPct / 100)
      at.bills += 1
      buckets.set(key, at)
      if (!buckets.get(key)!.category) buckets.get(key)!.category = "Uncategorised"
    }
  }

  // The display name comes from the line, so a renamed item still reads as it
  // was sold rather than as it is called now.
  const labels = new Map<string, string>()
  for (const { doc } of bills) {
    for (const line of doc.lines) {
      const key = line.item ? String(line.item) : `custom:${line.name.toLowerCase()}`
      if (!labels.has(key)) labels.set(key, line.name)
    }
  }

  const rows = [...buckets.entries()]
    .map(([key, at]) => ({
      product: labels.get(key) ?? "—",
      category: at.category,
      qty: round2(at.qty),
      lines: at.bills,
      revenue: round2(at.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const revenueTotal = rows.reduce((n, r) => n + r.revenue, 0)

  return {
    slug: "sales-by-product",
    columns: [
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "qty", label: "Quantity", align: "right", format: "number" },
      { key: "lines", label: "Times sold", align: "right", format: "number" },
      { key: "revenue", label: "Revenue", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "PRODUCTS SOLD", value: String(rows.length) },
      { label: "UNITS", value: String(round2(rows.reduce((n, r) => n + r.qty, 0))) },
      { label: "REVENUE", value: money(revenueTotal) },
      { label: "TOP SELLER", value: rows[0]?.product ?? "—" },
    ],
    totals: [{ label: "Revenue", value: money(revenueTotal) }],
  }
}

async function salesByCustomer(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const buckets = new Map<string, { bills: number; total: number; paid: number; last: string }>()

  for (const { doc, paid } of bills) {
    const key = doc.customer?.name?.trim() || "Walk-in"
    const at = buckets.get(key) ?? { bills: 0, total: 0, paid: 0, last: "" }
    at.bills += 1
    at.total += doc.total
    at.paid += receivedOf(doc, paid)
    const day = dayKeyInZone(doc.createdAt as Date, s.zone)
    if (day > at.last) at.last = day
    buckets.set(key, at)
  }

  const rows = [...buckets.entries()]
    .map(([customer, at]) => ({
      customer,
      bills: at.bills,
      total: round2(at.total),
      paid: round2(at.paid),
      due: round2(Math.max(0, at.total - at.paid)),
      last: at.last,
    }))
    .sort((a, b) => b.total - a.total)

  const due = rows.reduce((n, r) => n + r.due, 0)

  return {
    slug: "sales-by-customer",
    columns: [
      { key: "customer", label: "Customer" },
      { key: "bills", label: "Bills", align: "right", format: "number" },
      { key: "total", label: "Total", align: "right", format: "money" },
      { key: "paid", label: "Received", align: "right", format: "money" },
      { key: "due", label: "Still owed", align: "right", format: "money" },
      { key: "last", label: "Last bill", format: "day" },
    ],
    rows,
    stats: [
      { label: "CUSTOMERS", value: String(rows.length) },
      { label: "TOTAL", value: money(rows.reduce((n, r) => n + r.total, 0)) },
      { label: "STILL OWED", value: money(due), accent: due > 0 },
      { label: "BIGGEST", value: rows[0]?.customer ?? "—" },
    ],
    totals: [
      { label: "Total", value: money(rows.reduce((n, r) => n + r.total, 0)) },
      { label: "Still owed", value: money(due) },
    ],
  }
}

async function salesByCategory(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const items = await InventoryItem.find({ business: s.businessId })
    .select("name category")
    .populate<{ category: { _id: unknown; name?: string } }>("category", "name")

  const categoryOf = new Map(
    items.map((one) => [String(one._id), one.category?.name ?? "Uncategorised"])
  )

  const buckets = new Map<string, { qty: number; revenue: number; lines: number }>()
  for (const { doc } of bills) {
    for (const line of doc.lines) {
      const key = line.item
        ? (categoryOf.get(String(line.item)) ?? "Uncategorised")
        : "Typed by hand"
      const at = buckets.get(key) ?? { qty: 0, revenue: 0, lines: 0 }
      at.qty += line.qty
      at.revenue += line.price * line.qty * (1 - line.discountPct / 100)
      at.lines += 1
      buckets.set(key, at)
    }
  }

  const rows = [...buckets.entries()]
    .map(([category, at]) => ({
      category,
      qty: round2(at.qty),
      lines: at.lines,
      revenue: round2(at.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const total = rows.reduce((n, r) => n + r.revenue, 0)
  const withShare = rows.map((row) => ({
    ...row,
    share: total === 0 ? 0 : round2((row.revenue / total) * 100),
  }))

  return {
    slug: "sales-by-category",
    columns: [
      { key: "category", label: "Category" },
      { key: "lines", label: "Lines", align: "right", format: "number" },
      { key: "qty", label: "Quantity", align: "right", format: "number" },
      { key: "revenue", label: "Revenue", align: "right", format: "money" },
      { key: "share", label: "Share %", align: "right", format: "number" },
    ],
    rows: withShare,
    stats: [
      { label: "CATEGORIES", value: String(rows.length) },
      { label: "REVENUE", value: money(total) },
      { label: "STRONGEST", value: rows[0]?.category ?? "—" },
    ],
    totals: [{ label: "Revenue", value: money(total) }],
  }
}

// ---- inventory -----------------------------------------------------------

async function loadItems(s: Scope) {
  const filter: Record<string, unknown> = { business: s.businessId }
  if (s.categoryId) filter.category = s.categoryId

  return InventoryItem.find(filter)
    .sort({ name: 1 })
    .limit(5000)
    .populate<{ category: { _id: unknown; name?: string } }>("category", "name")
}

async function currentStock(valuation: boolean, s: Scope): Promise<ReportPayload> {
  const items = await loadItems(s)

  const rows = items.map((item) => ({
    item: item.name,
    sku: item.sku ?? "—",
    category: item.category?.name ?? "Uncategorised",
    unit: item.unit,
    stock: item.stock,
    price: round2(item.price),
    value: round2(item.stock * item.price),
    state:
      item.stock === 0
        ? "Out of stock"
        : item.stock <= item.lowStockAt
          ? "Low"
          : "In stock",
  }))

  const value = rows.reduce((n, r) => n + r.value, 0)
  const low = rows.filter((r) => r.state !== "In stock").length

  return {
    slug: valuation ? "stock-valuation" : "current-stock",
    columns: [
      { key: "item", label: "Item" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      { key: "stock", label: "On hand", align: "right", format: "number" },
      { key: "price", label: "Sell price", align: "right", format: "money" },
      { key: "value", label: "Retail value", align: "right", format: "money" },
      ...(valuation ? [] : [{ key: "state", label: "State" } as const]),
    ],
    rows,
    stats: [
      { label: "ITEMS", value: String(rows.length) },
      { label: "UNITS ON HAND", value: String(round2(rows.reduce((n, r) => n + r.stock, 0))) },
      { label: "RETAIL VALUE", value: money(value) },
      ...(valuation
        ? []
        : [{ label: "NEEDS ATTENTION", value: String(low), accent: low > 0 }]),
    ],
    totals: [{ label: "Retail value", value: money(value) }],
  }
}

async function lowStock(s: Scope): Promise<ReportPayload> {
  const items = await loadItems(s)

  const rows = items
    .filter((item) => item.stock <= item.lowStockAt)
    .map((item) => ({
      item: item.name,
      category: item.category?.name ?? "Uncategorised",
      unit: item.unit,
      stock: item.stock,
      lowAt: item.lowStockAt,
      short: round2(Math.max(0, item.lowStockAt - item.stock)),
      state: item.stock === 0 ? "Out of stock" : "Low",
    }))
    .sort((a, b) => b.short - a.short || a.stock - b.stock)

  const out = rows.filter((r) => r.state === "Out of stock").length

  return {
    slug: "low-stock",
    columns: [
      { key: "item", label: "Item" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      { key: "stock", label: "On hand", align: "right", format: "number" },
      { key: "lowAt", label: "Low at", align: "right", format: "number" },
      { key: "short", label: "Short by", align: "right", format: "number" },
      { key: "state", label: "State" },
    ],
    rows,
    stats: [
      { label: "AT OR BELOW", value: String(rows.length), accent: rows.length > 0 },
      { label: "OUT OF STOCK", value: String(out), accent: out > 0 },
    ],
    totals: [],
    note:
      rows.length === 0
        ? "Nothing is at its low-stock level. Set one on an item to be warned earlier."
        : undefined,
  }
}

async function stockMovement(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const items = await loadItems(s)
  const allowed = new Set(items.map((one) => String(one._id)))

  const rows: Record<string, string | number | null>[] = []
  for (const { doc } of bills) {
    for (const line of doc.lines) {
      const itemId = line.item ? String(line.item) : ""
      if (s.categoryId && !allowed.has(itemId)) continue

      rows.push({
        day: dayKeyInZone(doc.createdAt as Date, s.zone),
        item: line.name,
        direction: "Out",
        qty: round2(line.qty),
        unit: line.unit,
        bill: doc.number,
        customer: doc.customer?.name ?? "Walk-in",
      })
    }
  }

  rows.sort((a, b) => String(b.day).localeCompare(String(a.day)))
  const units = rows.reduce((n, r) => n + Number(r.qty ?? 0), 0)

  return {
    slug: "stock-movement",
    columns: [
      { key: "day", label: "Day", format: "day" },
      { key: "item", label: "Item" },
      { key: "direction", label: "Direction" },
      { key: "qty", label: "Quantity", align: "right", format: "number" },
      { key: "unit", label: "Unit" },
      { key: "bill", label: "Bill" },
      { key: "customer", label: "Customer" },
    ],
    rows,
    stats: [
      { label: "MOVEMENTS", value: String(rows.length) },
      { label: "UNITS OUT", value: String(round2(units)) },
    ],
    totals: [{ label: "Units out", value: String(round2(units)) }],
  }
}

async function movingProducts(fast: boolean, s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const items = await loadItems(s)

  const sold = new Map<string, { qty: number; revenue: number; last: string }>()
  for (const { doc } of bills) {
    for (const line of doc.lines) {
      if (!line.item) continue
      const key = String(line.item)
      const at = sold.get(key) ?? { qty: 0, revenue: 0, last: "" }
      at.qty += line.qty
      at.revenue += line.price * line.qty * (1 - line.discountPct / 100)
      const day = dayKeyInZone(doc.createdAt as Date, s.zone)
      if (day > at.last) at.last = day
      sold.set(key, at)
    }
  }

  // Slow-moving has to include what never sold at all, which is exactly the
  // set a sales-only query would miss — so it is built from the item list.
  const rows = items
    .map((item) => {
      const at = sold.get(String(item._id)) ?? { qty: 0, revenue: 0, last: "" }
      return {
        item: item.name,
        category: item.category?.name ?? "Uncategorised",
        stock: item.stock,
        qty: round2(at.qty),
        revenue: round2(at.revenue),
        last: at.last || "never",
      }
    })
    .sort((a, b) => (fast ? b.qty - a.qty : a.qty - b.qty || b.stock - a.stock))
    .filter((row) => (fast ? row.qty > 0 : true))
    .slice(0, 100)

  const neverSold = rows.filter((r) => r.qty === 0).length

  return {
    slug: fast ? "fast-moving" : "slow-moving",
    columns: [
      { key: "item", label: "Item" },
      { key: "category", label: "Category" },
      { key: "qty", label: "Sold", align: "right", format: "number" },
      { key: "revenue", label: "Revenue", align: "right", format: "money" },
      { key: "stock", label: "Still on hand", align: "right", format: "number" },
      { key: "last", label: "Last sold", format: "day" },
    ],
    rows,
    stats: fast
      ? [
          { label: "MOVING", value: String(rows.length) },
          { label: "TOP SELLER", value: rows[0]?.item ?? "—" },
          { label: "UNITS", value: String(round2(rows.reduce((n, r) => n + r.qty, 0))) },
        ]
      : [
          { label: "LISTED", value: String(rows.length) },
          { label: "NEVER SOLD", value: String(neverSold), accent: neverSold > 0 },
          {
            label: "STOCK SITTING",
            value: String(round2(rows.reduce((n, r) => n + r.stock, 0))),
          },
        ],
    totals: [],
    note: fast
      ? undefined
      : "Sorted by least sold first, and everything that never sold is in here too.",
  }
}

// ---- finance -------------------------------------------------------------

async function revenue(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills(s)
  const buckets = new Map<
    string,
    { bills: number; net: number; vat: number; total: number; discount: number }
  >()

  for (const { doc } of bills) {
    const key = dayKeyInZone(doc.createdAt as Date, s.zone).slice(0, 7)
    const at = buckets.get(key) ?? { bills: 0, net: 0, vat: 0, total: 0, discount: 0 }
    at.bills += 1
    at.net += doc.taxable
    at.vat += doc.vatAmount
    at.total += doc.total
    at.discount += doc.discountTotal
    buckets.set(key, at)
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, at]) => ({
      period,
      bills: at.bills,
      discount: round2(at.discount),
      net: round2(at.net),
      vat: round2(at.vat),
      total: round2(at.total),
    }))

  const net = rows.reduce((n, r) => n + r.net, 0)
  const total = rows.reduce((n, r) => n + r.total, 0)

  return {
    slug: "revenue",
    columns: [
      { key: "period", label: "Month", format: "month" },
      { key: "bills", label: "Bills", align: "right", format: "number" },
      { key: "discount", label: "Discount given", align: "right", format: "money" },
      { key: "net", label: "Net of VAT", align: "right", format: "money" },
      { key: "vat", label: "VAT", align: "right", format: "money" },
      { key: "total", label: "Billed", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "BILLED", value: money(total) },
      { label: "NET OF VAT", value: money(net) },
      { label: "VAT", value: money(rows.reduce((n, r) => n + r.vat, 0)) },
      { label: "MONTHS", value: String(rows.length) },
    ],
    totals: [
      { label: "Net of VAT", value: money(net) },
      { label: "Billed", value: money(total) },
    ],
  }
}

async function loadPayments(direction: "in" | "out", s: Scope) {
  const filter: Record<string, unknown> = {
    business: s.businessId,
    direction,
  }
  if (s.from || s.to) {
    filter.paidOn = {
      ...(s.from ? { $gte: s.from } : {}),
      ...(s.to ? { $lte: s.to } : {}),
    }
  }
  return Payment.find(filter)
    .sort({ paidOn: -1 })
    .limit(5000)
    .populate<{ bill: { _id: unknown; number?: string } }>("bill", "number")
}

async function expenses(s: Scope): Promise<ReportPayload> {
  const payments = await loadPayments("out", s)

  const buckets = new Map<string, { n: number; amount: number; methods: Set<string> }>()
  for (const one of payments) {
    const at = buckets.get(one.party) ?? { n: 0, amount: 0, methods: new Set<string>() }
    at.n += 1
    at.amount += one.amount
    at.methods.add(one.method)
    buckets.set(one.party, at)
  }

  const rows = [...buckets.entries()]
    .map(([party, at]) => ({
      party,
      payments: at.n,
      methods: [...at.methods].join(", "),
      amount: round2(at.amount),
    }))
    .sort((a, b) => b.amount - a.amount)

  const total = rows.reduce((n, r) => n + r.amount, 0)

  return {
    slug: "expenses",
    columns: [
      { key: "party", label: "Paid to" },
      { key: "payments", label: "Payments", align: "right", format: "number" },
      { key: "methods", label: "How" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "PAID OUT", value: money(total) },
      { label: "PARTIES", value: String(rows.length) },
      { label: "PAYMENTS", value: String(rows.reduce((n, r) => n + r.payments, 0)) },
    ],
    totals: [{ label: "Paid out", value: money(total) }],
    note: "Everything recorded on the Payments page as money going out. It is not a full expense ledger — only what was entered there.",
  }
}

async function receivables(s: Scope): Promise<ReportPayload> {
  const bills = await loadBills({ ...s, payment: null })
  const today = Date.now()

  const rows = bills
    .map(({ doc, paid }) => ({
      bill: doc.number,
      customer: doc.customer?.name ?? "Walk-in",
      day: dayKeyInZone(doc.createdAt as Date, s.zone),
      total: round2(doc.total),
      paid: receivedOf(doc, paid),
      due: dueOf(doc, paid),
      age: Math.max(
        0,
        Math.round((today - (doc.createdAt as Date).getTime()) / 86_400_000)
      ),
      state: doc.payment,
    }))
    .filter((row) => row.due > 0)
    .sort((a, b) => b.age - a.age)

  const due = rows.reduce((n, r) => n + r.due, 0)
  const over30 = rows.filter((r) => r.age > 30).reduce((n, r) => n + r.due, 0)

  return {
    slug: "receivables",
    columns: [
      { key: "bill", label: "Bill" },
      { key: "customer", label: "Customer" },
      { key: "day", label: "Raised", format: "day" },
      { key: "age", label: "Days", align: "right", format: "number" },
      { key: "total", label: "Total", align: "right", format: "money" },
      { key: "paid", label: "Received", align: "right", format: "money" },
      { key: "due", label: "Still owed", align: "right", format: "money" },
      { key: "state", label: "Marked" },
    ],
    rows,
    stats: [
      { label: "STILL OWED", value: money(due), accent: due > 0 },
      { label: "BILLS", value: String(rows.length) },
      { label: "OVER 30 DAYS", value: money(over30), accent: over30 > 0 },
      { label: "OLDEST", value: rows[0] ? `${rows[0].age} days` : "—" },
    ],
    totals: [{ label: "Still owed", value: money(due) }],
  }
}

async function partyPayments(direction: "in" | "out", s: Scope): Promise<ReportPayload> {
  const payments = await loadPayments(direction, s)

  const rows = payments.map((one) => ({
    day: dayKeyInZone(one.paidOn, s.zone),
    party: one.party,
    amount: round2(one.amount),
    method: one.method,
    reference: one.reference ?? "—",
    bill: one.bill?.number ?? "—",
    note: one.note ?? "",
  }))

  const total = rows.reduce((n, r) => n + r.amount, 0)
  const parties = new Set(rows.map((r) => r.party)).size

  return {
    slug: direction === "in" ? "customer-payments" : "supplier-payments",
    columns: [
      { key: "day", label: "Day", format: "day" },
      { key: "party", label: direction === "in" ? "Customer" : "Paid to" },
      { key: "amount", label: "Amount", align: "right", format: "money" },
      { key: "method", label: "How" },
      { key: "reference", label: "Reference" },
      ...(direction === "in" ? [{ key: "bill", label: "Against bill" } as const] : []),
      { key: "note", label: "Note" },
    ],
    rows,
    stats: [
      { label: direction === "in" ? "RECEIVED" : "PAID OUT", value: money(total) },
      { label: "PAYMENTS", value: String(rows.length) },
      { label: direction === "in" ? "CUSTOMERS" : "PARTIES", value: String(parties) },
    ],
    totals: [
      { label: direction === "in" ? "Received" : "Paid out", value: money(total) },
    ],
  }
}

async function cashFlow(s: Scope): Promise<ReportPayload> {
  const [inbound, outbound] = await Promise.all([
    loadPayments("in", s),
    loadPayments("out", s),
  ])

  const buckets = new Map<string, { in: number; out: number }>()
  for (const one of inbound) {
    const key = dayKeyInZone(one.paidOn, s.zone).slice(0, 7)
    const at = buckets.get(key) ?? { in: 0, out: 0 }
    at.in += one.amount
    buckets.set(key, at)
  }
  for (const one of outbound) {
    const key = dayKeyInZone(one.paidOn, s.zone).slice(0, 7)
    const at = buckets.get(key) ?? { in: 0, out: 0 }
    at.out += one.amount
    buckets.set(key, at)
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, at]) => ({
      period,
      moneyIn: round2(at.in),
      moneyOut: round2(at.out),
      net: round2(at.in - at.out),
    }))

  const totalIn = rows.reduce((n, r) => n + r.moneyIn, 0)
  const totalOut = rows.reduce((n, r) => n + r.moneyOut, 0)

  return {
    slug: "cash-flow",
    columns: [
      { key: "period", label: "Month", format: "month" },
      { key: "moneyIn", label: "In", align: "right", format: "money" },
      { key: "moneyOut", label: "Out", align: "right", format: "money" },
      { key: "net", label: "Net", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "IN", value: money(totalIn) },
      { label: "OUT", value: money(totalOut) },
      { label: "NET", value: money(totalIn - totalOut), accent: totalIn - totalOut < 0 },
    ],
    totals: [
      { label: "In", value: money(totalIn) },
      { label: "Out", value: money(totalOut) },
      { label: "Net", value: money(totalIn - totalOut) },
    ],
    note: "Counted from payments actually recorded, not from bills raised — a bill nobody has paid moves nothing here.",
  }
}

// ---- employee ------------------------------------------------------------

async function crewFor(s: Scope) {
  const filter: Record<string, unknown> = { business: s.businessId }
  if (s.employeeId) filter._id = s.employeeId
  return User.find(filter).select("name role shift status").sort({ name: 1 })
}

function dayBounds(s: Scope) {
  const from = s.from ? dayKeyInZone(s.from, s.zone) : "0000-00-00"
  const to = s.to ? dayKeyInZone(s.to, s.zone) : "9999-99-99"
  return { from, to }
}

async function attendanceReport(s: Scope): Promise<ReportPayload> {
  const crew = await crewFor(s)
  const { from, to } = dayBounds(s)

  const records = await Attendance.find({
    business: s.businessId,
    day: { $gte: from, $lte: to },
    ...(s.employeeId ? { user: s.employeeId } : {}),
  })

  const buckets = new Map<
    string,
    { present: number; late: number; leave: number; lateMin: number; away: number; hours: number }
  >()

  for (const row of records) {
    const key = String(row.user)
    const at = buckets.get(key) ?? {
      present: 0, late: 0, leave: 0, lateMin: 0, away: 0, hours: 0,
    }
    if (row.status === "leave") at.leave += 1
    else if (row.inAt) {
      at.present += 1
      if (row.status === "late") at.late += 1
      at.lateMin += row.lateByMin ?? 0
      if (row.inPlace === "away") at.away += 1
      if (row.inAt && row.outAt) {
        at.hours += (row.outAt.getTime() - row.inAt.getTime()) / 3_600_000
      }
    }
    buckets.set(key, at)
  }

  const rows = crew.map((member) => {
    const at = buckets.get(String(member._id)) ?? {
      present: 0, late: 0, leave: 0, lateMin: 0, away: 0, hours: 0,
    }
    return {
      person: member.name,
      role: member.role,
      worked: at.present,
      late: at.late,
      lateMinutes: at.lateMin,
      leave: at.leave,
      away: at.away,
      hours: round2(at.hours),
    }
  })

  return {
    slug: "attendance-report",
    columns: [
      { key: "person", label: "Person" },
      { key: "role", label: "Role" },
      { key: "worked", label: "Days worked", align: "right", format: "number" },
      { key: "late", label: "Late", align: "right", format: "number" },
      { key: "lateMinutes", label: "Late minutes", align: "right", format: "number" },
      { key: "leave", label: "Leave", align: "right", format: "number" },
      { key: "away", label: "Opened away", align: "right", format: "number" },
      { key: "hours", label: "Hours", align: "right", format: "number" },
    ],
    rows,
    stats: [
      { label: "CREW", value: String(rows.length) },
      { label: "DAYS WORKED", value: String(rows.reduce((n, r) => n + r.worked, 0)) },
      {
        label: "LATE DAYS",
        value: String(rows.reduce((n, r) => n + r.late, 0)),
        accent: rows.some((r) => r.late > 0),
      },
      { label: "HOURS", value: String(round2(rows.reduce((n, r) => n + r.hours, 0))) },
    ],
    totals: [
      { label: "Days worked", value: String(rows.reduce((n, r) => n + r.worked, 0)) },
      { label: "Hours", value: String(round2(rows.reduce((n, r) => n + r.hours, 0))) },
    ],
    note: "Hours are counted from the shift being opened and closed, so a day nobody closed reads as zero.",
  }
}

async function leaveReport(s: Scope): Promise<ReportPayload> {
  const filter: Record<string, unknown> = {
    business: s.businessId,
    kind: "leave",
  }
  if (s.employeeId) filter.user = s.employeeId
  if (s.from || s.to) {
    filter.createdAt = {
      ...(s.from ? { $gte: s.from } : {}),
      ...(s.to ? { $lte: s.to } : {}),
    }
  }

  const requests = await WorkRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(2000)
    .populate<{ user: { _id: unknown; name?: string } }>("user", "name")

  const rows = requests.map((one) => ({
    person: one.user?.name ?? "Someone who has left",
    raised: dayKeyInZone(one.createdAt as Date, s.zone),
    startDate: one.startDate ?? "—",
    endDate: one.endDate ?? "—",
    days:
      one.startDate && one.endDate
        ? Math.max(
            1,
            Math.round(
              (Date.parse(one.endDate) - Date.parse(one.startDate)) / 86_400_000
            ) + 1
          )
        : 0,
    status: one.status,
    message: one.message,
  }))

  const approved = rows.filter((r) => r.status === "approved")

  return {
    slug: "leave-report",
    columns: [
      { key: "person", label: "Person" },
      { key: "raised", label: "Asked on", format: "day" },
      { key: "startDate", label: "From", format: "day" },
      { key: "endDate", label: "To", format: "day" },
      { key: "days", label: "Days", align: "right", format: "number" },
      { key: "status", label: "Outcome" },
      { key: "message", label: "Reason" },
    ],
    rows,
    stats: [
      { label: "REQUESTS", value: String(rows.length) },
      { label: "APPROVED", value: String(approved.length) },
      {
        label: "PENDING",
        value: String(rows.filter((r) => r.status === "pending").length),
        accent: rows.some((r) => r.status === "pending"),
      },
      { label: "DAYS GRANTED", value: String(approved.reduce((n, r) => n + r.days, 0)) },
    ],
    totals: [
      { label: "Days granted", value: String(approved.reduce((n, r) => n + r.days, 0)) },
    ],
  }
}

async function employeeActivity(s: Scope): Promise<ReportPayload> {
  const crew = await crewFor(s)
  const ids = crew.map((one) => one._id)

  const window: Record<string, unknown> = {}
  if (s.from || s.to) {
    window.$gte = s.from ?? new Date(0)
    if (s.to) window.$lte = s.to
  }
  const hasWindow = Object.keys(window).length > 0

  const [tasks, visits, bills] = await Promise.all([
    Task.find({
      business: s.businessId,
      assignees: { $in: ids },
      ...(hasWindow ? { startAt: window } : {}),
    }).select("assignees status"),
    CheckIn.find({
      business: s.businessId,
      user: { $in: ids },
      type: "in",
      ...(hasWindow ? { at: window } : {}),
    }).select("user insideFence"),
    Bill.find({
      business: s.businessId,
      status: "issued",
      payment: { $ne: "quotation" },
      issuedBy: { $in: ids },
      ...(hasWindow ? { createdAt: window } : {}),
    }).select("issuedBy total"),
  ])

  const rows = crew.map((member) => {
    const id = String(member._id)
    const mine = tasks.filter((t) =>
      (t.assignees ?? []).some((a) => String(a) === id)
    )
    const myVisits = visits.filter((v) => String(v.user) === id)
    const myBills = bills.filter((b) => String(b.issuedBy) === id)

    return {
      person: member.name,
      role: member.role,
      tasks: mine.length,
      done: mine.filter((t) => t.status === "done").length,
      checkIns: myVisits.length,
      outside: myVisits.filter((v) => !v.insideFence).length,
      bills: myBills.length,
      billed: round2(myBills.reduce((n, b) => n + b.total, 0)),
    }
  })

  return {
    slug: "employee-activity",
    columns: [
      { key: "person", label: "Person" },
      { key: "role", label: "Role" },
      { key: "tasks", label: "Tasks", align: "right", format: "number" },
      { key: "done", label: "Finished", align: "right", format: "number" },
      { key: "checkIns", label: "Check-ins", align: "right", format: "number" },
      { key: "outside", label: "Outside fence", align: "right", format: "number" },
      { key: "bills", label: "Bills raised", align: "right", format: "number" },
      { key: "billed", label: "Billed", align: "right", format: "money" },
    ],
    rows,
    stats: [
      { label: "CREW", value: String(rows.length) },
      { label: "TASKS FINISHED", value: String(rows.reduce((n, r) => n + r.done, 0)) },
      { label: "CHECK-INS", value: String(rows.reduce((n, r) => n + r.checkIns, 0)) },
      { label: "BILLED", value: money(rows.reduce((n, r) => n + r.billed, 0)) },
    ],
    totals: [{ label: "Billed", value: money(rows.reduce((n, r) => n + r.billed, 0)) }],
  }
}

// ---- parameter helpers ---------------------------------------------------

function asDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return null
  return new Date(value)
}

/** A "to" date means the whole of that day, not midnight at the start of it. */
function asEndOfDay(value: string | null) {
  const at = asDate(value)
  if (!at) return null
  at.setHours(23, 59, 59, 999)
  return at
}

function asId(value: string | null) {
  return value && Types.ObjectId.isValid(value) ? value : null
}
