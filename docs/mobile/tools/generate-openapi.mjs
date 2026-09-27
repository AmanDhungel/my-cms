// Generates docs/mobile/openapi.json.
//
//   node --experimental-strip-types --no-warnings docs/mobile/tools/generate-openapi.mjs
//
// Request bodies are converted from the app's own Zod schemas
// (src/lib/validations/*.ts, imported unchanged) with Zod v4's
// z.toJSONSchema — no new dependency. A handful of small schemas are declared
// inline in route files and not exported; those are copied here verbatim and
// cite their source. Response bodies are TypeScript DTO types, not Zod, so
// they are transcribed below as Zod shapes, each citing its model file.
//
// What JSON Schema cannot carry — cross-field .refine() rules — is listed per
// operation under `x-refinements`, so nothing the server enforces is lost.
import { register } from "node:module"
import { writeFileSync } from "node:fs"

register("./ts-alias-loader.mjs", import.meta.url)

const { z } = await import("zod")
const load = (p) => import(new URL(`../../../src/${p}.ts`, import.meta.url).href)

const auth = await load("lib/validations/auth")
const work = await load("lib/validations/work")
const accounts = await load("lib/validations/accounts")
const customers = await load("lib/validations/customers")
const expenses = await load("lib/validations/expenses")
const inventory = await load("lib/validations/inventory")
const maintenance = await load("lib/validations/maintenance")
const operations = await load("lib/validations/operations")
const payments = await load("lib/validations/payments")
const review = await load("lib/validations/review")
const sales = await load("lib/validations/sales")
const site = await load("lib/validations/site")
const uploads = await load("lib/validations/uploads")
const C = await load("lib/work-constants")

const BASE = "https://my-cms-ebon.vercel.app"
const notes = []

// ---- inline route schemas (not exported; copied verbatim) -----------------

/** src/app/api/notifications/route.ts:55-60 */
const markNotificationsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "That isn't a notification").optional(),
})
/** src/app/api/admin/businesses/[id]/route.ts:10 and admin/users/[id]/route.ts:11 */
const blockSchema = z.object({ blocked: z.boolean() })
/** src/app/api/admin/invites/route.ts:17-25 (the isSuperAdmin refine is server-only) */
const workspaceInviteSchema = z.object({
  email: z.union([z.literal(""), z.email("That email doesn't look right")]).optional(),
  businessName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
})
/** src/app/api/site/route.ts:163-167 — checked by hand, no Zod schema */
const publishSchema = z.object({ published: z.boolean() })
/** src/app/api/auth/[...nextauth]/route.ts:52-54 + Auth.js credentials form */
const credentialsForm = z.object({
  csrfToken: z.string().describe("From GET /api/auth/csrf; must match the __Host-authjs.csrf-token cookie"),
  email: z.string(),
  password: z.string(),
  callbackUrl: z.string().optional(),
  redirect: z.string().optional().describe('"false" makes Auth.js answer JSON {url} instead of a 302'),
})
/** Auth.js sign-out form */
const signoutForm = z.object({ csrfToken: z.string(), callbackUrl: z.string().optional() })
/** src/app/api/uploads/route.ts:76-78 — multipart fields */
const uploadForm = z.object({
  purpose: z.enum(["site", "maintenance", "ticket", "products", "logo"]),
  file: z.string().describe("binary; JPEG/PNG/WebP/AVIF by magic bytes; <= 1,000,000 bytes"),
})

// ---- response DTOs (transcribed from TypeScript types) --------------------

const id = z.string().describe("24-hex ObjectId")
const iso = z.string().describe("ISO-8601 instant")
const day = z.string().describe("YYYY-MM-DD in the workspace time zone")
const named = z.object({ id, name: z.string() })
const n = (s) => s.nullable()

/** src/lib/week.ts:15-28 */
const WeekPattern = z
  .array(z.object({ kind: z.enum(C.PATTERN_KINDS), startTime: n(z.string()), endTime: n(z.string()) }))
  .length(7)
  .describe("Monday first")

/** src/models/ticket.ts:200-250 */
const TicketDTO = z.object({
  id, title: z.string(), description: n(z.string()), site: z.string(),
  lat: z.number(), lng: z.number(), radiusM: z.number(),
  startAt: iso, endAt: iso,
  status: z.enum(C.TICKET_STATUSES), priority: z.enum(C.TICKET_PRIORITIES),
  blockedReason: n(z.string()),
  blocker: n(z.object({
    reason: n(z.enum(C.BLOCKER_REASONS)), note: n(z.string()),
    needs: z.array(z.object({ name: z.string(), qty: n(z.number()), unit: n(z.string()) })),
    raisedAt: n(iso),
  })),
  materials: z.array(z.object({
    itemId: n(id), name: z.string(), unit: z.string(), qty: z.number(), unitCost: z.number(), total: z.number(),
  })),
  materialsTotal: z.number(),
  onSite: z.array(z.object({ id, name: z.string(), at: iso })),
  myCheckedInAt: n(iso),
  checkedOutAt: n(iso),
  assignees: z.array(named),
  project: n(named),
  photos: z.array(z.object({
    url: z.string(), uploadedById: id, uploadedByName: z.string(), uploadedAt: iso, byMe: z.boolean(),
  })),
})
/** src/models/check-in.ts:57-68 */
const CheckInDTO = z.object({
  id, ticketId: id, type: z.enum(C.CHECK_IN_TYPES), at: iso, distanceM: z.number(), insideFence: z.boolean(),
  reason: n(z.string()), overtime: z.boolean(), overtimeReason: n(z.string()), overtimeMinutes: z.number(),
})
/** src/models/attendance.ts:110-135 */
const AttendanceDTO = z.object({
  id, day, inAt: n(iso), outAt: n(iso),
  inSource: n(z.enum(C.ATTENDANCE_SOURCES)), outSource: n(z.enum(C.ATTENDANCE_SOURCES)),
  status: z.enum(C.ATTENDANCE_STATUSES), lateByMin: z.number(), shift: n(z.string()),
  inPlace: n(z.enum(C.SHIFT_PLACES)), inDistanceM: n(z.number()), inLat: n(z.number()), inLng: n(z.number()),
  inAccuracyM: n(z.number()), inReason: n(z.enum(C.AWAY_REASONS)), inNote: n(z.string()),
  outPlace: n(z.enum(C.SHIFT_PLACES)), outDistanceM: n(z.number()), outLat: n(z.number()), outLng: n(z.number()),
  outAccuracyM: n(z.number()),
  overtime: z.boolean(), overtimeReason: n(z.string()), overtimeMinutes: z.number(),
})
/** src/models/user.ts:115-126 */
const UserDTO = z.object({
  id, name: z.string(), email: z.string(), phone: z.string(),
  role: z.enum(["owner", "supervisor", "employee"]), shift: n(z.string()), week: n(WeekPattern),
  status: z.enum(C.MEMBER_STATUSES), blockedAt: n(iso), businessId: id,
})
/** src/models/business.ts:140-158 */
const BusinessDTO = z.object({
  id, name: z.string(), crewSize: z.string(), timeZone: z.string(),
  office: n(z.object({ lat: z.number(), lng: z.number(), label: n(z.string()), radiusM: z.number(), awayRadiusM: z.number() })),
  week: n(WeekPattern), pan: n(z.string()), vatRate: z.number(),
  logo: n(z.object({ key: z.string(), url: z.string() })), blockedAt: n(iso), ownerId: id,
})
/** src/models/invite.ts:66-75 */
const InviteDTO = z.object({
  id, name: z.string(), email: z.string(), phone: z.string(), role: z.enum(["supervisor", "employee"]),
  shift: z.string(), expiresAt: iso, acceptedAt: n(iso),
})
/** src/lib/auth/invites.ts:6-17 */
const PendingInvite = z.object({
  id, name: z.string(), email: z.string(), phone: z.string(), role: z.enum(["supervisor", "employee"]),
  shift: z.string(), message: n(z.string()), businessId: id, businessName: z.string(), expiresAt: iso,
})
/** src/models/workspace-invite.ts:58-69 */
const WorkspaceInviteDTO = z.object({
  id, email: n(z.string()), businessName: n(z.string()), note: n(z.string()),
  state: z.enum(["pending", "used", "revoked", "expired"]), expiresAt: iso, createdAt: iso,
  acceptedAt: n(iso), workspace: n(z.string()),
})
/** src/models/request.ts:62-75 */
const RequestDTO = z.object({
  id, kind: z.enum(C.REQUEST_KINDS), message: z.string(), startDate: n(day), endDate: n(day),
  amount: n(z.number()), ticketId: n(id), status: z.enum(C.REQUEST_STATUSES), decisionNote: n(z.string()),
  decidedAt: n(iso), createdAt: iso, user: n(named),
})
/** src/models/project.ts:41-48 */
const ProjectDTO = z.object({
  id, name: z.string(), description: n(z.string()), site: n(z.string()),
  status: z.enum(C.PROJECT_STATUSES), createdAt: iso,
})
/** src/app/api/projects/route.ts:49-57 */
const ProjectWithCounts = ProjectDTO.extend({
  tickets: z.object({ total: z.number(), open: z.number(), blocked: z.number(), done: z.number() }),
})
/** src/models/notification.ts:47-55 */
const NotificationDTO = z.object({
  id, kind: z.enum(C.NOTIFICATION_KINDS), title: z.string(), body: n(z.string()), href: n(z.string()),
  readAt: n(iso), createdAt: iso,
})
/** src/models/activity.ts:73-86 */
const ActivityDTO = z.object({
  id, action: z.enum(C.ACTIVITY_ACTIONS), actorId: id, actorName: z.string(), subject: z.string(),
  detail: n(z.string()), from: n(z.string()), to: n(z.string()), targetKind: n(z.enum(C.ACTIVITY_TARGETS)),
  targetId: n(id), href: n(z.string()), at: iso,
})
/** src/models/bill.ts:186-251 */
const BillDTO = z.object({
  review: n(z.object({
    status: z.enum(C.REVIEW_STATUSES), invitedTo: n(z.string()), invitedAt: n(iso), expiresAt: n(iso),
    revoked: z.boolean(), decidedAt: n(iso), clientName: n(z.string()),
    remarks: z.array(z.object({ lineIndex: n(z.number()), text: z.string(), author: z.string(), fromClient: z.boolean(), at: iso })),
    token: n(z.string()),
  })),
  id, number: z.string(), source: z.enum(C.BILL_SOURCES),
  customer: z.object({ name: z.string(), phone: n(z.string()), email: n(z.string()), address: n(z.string()), pan: n(z.string()) }),
  customerId: n(id),
  lines: z.array(z.object({
    itemId: n(id), name: z.string(), unit: z.string(), price: z.number(), qty: z.number(), discountPct: z.number(),
    gross: z.number(), discount: z.number(), net: z.number(),
  })),
  vatRate: z.number(), subtotal: z.number(), discountTotal: z.number(), taxable: z.number(),
  vatAmount: z.number(), total: z.number(), note: n(z.string()), paid: z.number(), due: z.number(),
  payment: z.enum(C.BILL_PAYMENTS), chequeNo: n(z.string()), status: z.enum(C.BILL_STATUSES),
  issuedBy: id, createdAt: iso, voidedAt: n(iso),
})
/** src/lib/quote-review.ts:17-50 */
const PublicQuote = z.object({
  number: z.string(), business: z.string(), customer: z.string(),
  lines: z.array(z.object({ name: z.string(), unit: z.string(), price: z.number(), qty: z.number(), discountPct: z.number(), total: z.number() })),
  subtotal: z.number(), discountTotal: z.number(), taxable: z.number(), vatRate: z.number(), vatAmount: z.number(),
  total: z.number(), note: n(z.string()), issuedOn: iso, status: z.string(), decidedAt: n(iso), clientName: n(z.string()),
  remarks: z.array(z.object({ lineIndex: n(z.number()), text: z.string(), author: z.string(), fromClient: z.boolean(), at: iso })),
})
/** src/models/customer.ts:52-63 */
const CustomerDTO = z.object({
  id, name: z.string(), kind: z.enum(C.PARTY_KINDS), company: n(z.string()), phone: n(z.string()),
  email: n(z.string()), location: n(z.string()), pan: n(z.string()), note: n(z.string()), createdAt: iso,
})
/** src/lib/ledger.ts:77-106 */
const PartyLedger = z.object({
  entries: z.array(z.object({
    id, on: day, kind: z.enum(["bill", "payment-in", "payment-out", "expense"]), reference: z.string(),
    detail: n(z.string()), debit: z.number(), credit: z.number(), href: n(z.string()),
  })),
  billed: z.number(), received: z.number(), paidOut: z.number(), owed: z.number(), running: z.array(z.number()),
})
/** src/models/expense.ts:117-143 */
const ExpenseDTO = z.object({
  id, kind: z.enum(C.EXPENSE_KINDS), payee: z.string(), partyId: n(id), accountId: n(id), employee: n(named),
  amount: z.number(), method: z.enum(C.PAYMENT_METHODS), reference: n(z.string()), note: n(z.string()),
  spentOn: day,
  lines: z.array(z.object({ itemId: n(id), name: z.string(), unit: z.string(), qty: z.number(), cost: z.number(), total: z.number() })),
  recordedBy: n(named), createdAt: iso,
})
/** src/models/inventory-category.ts:34-39 (+ items count, categories/route.ts:38-41) */
const CategoryDTO = z.object({ id, name: z.string(), description: n(z.string()), createdAt: iso })
const CategoryWithCount = CategoryDTO.extend({ items: z.number() })
/** src/models/inventory-item.ts:97-113 */
const ItemDTO = z.object({
  id, name: z.string(), sku: n(z.string()), description: n(z.string()), unit: z.enum(C.ITEM_UNITS),
  price: z.number(), costPrice: z.number(), stock: z.number(), lowStockAt: z.number(), location: n(z.string()),
  images: z.array(z.object({ key: z.string(), url: z.string(), uploadedById: n(id) })).max(3),
  category: n(named), createdAt: iso,
})
/** src/models/maintenance.ts:110-131 */
const MaintenanceDTO = z.object({
  id, item: z.string(), makeModel: n(z.string()), serialNumber: n(z.string()), owner: n(z.string()),
  ownerId: n(id), fault: z.string(), diagnosis: n(z.string()), status: z.enum(C.MAINTENANCE_STATUSES),
  receivedAt: day, dueAt: n(day), returnedAt: n(day), cost: n(z.number()), assignee: n(named),
  photos: z.array(z.string()), photoUploaders: z.record(z.string(), id), note: n(z.string()), createdAt: iso,
})
/** src/models/operation.ts:93-109 */
const OperationDTO = z.object({
  id, kind: z.enum(C.OPERATION_KINDS), title: z.string(), details: n(z.string()), startAt: iso, endAt: n(iso),
  allDay: z.boolean(), status: z.enum(C.OPERATION_STATUSES), priority: z.enum(C.TICKET_PRIORITIES),
  assignees: z.array(named), customer: n(named), project: n(named), location: n(z.string()),
  completedAt: n(iso), createdAt: iso,
})
/** src/models/payment.ts:96-110 */
const PaymentDTO = z.object({
  id, direction: z.enum(C.PAYMENT_DIRECTIONS), party: z.string(), partyId: n(id), accountId: n(id),
  amount: z.number(), method: z.enum(C.PAYMENT_METHODS), reference: n(z.string()), note: n(z.string()),
  paidOn: day, bill: n(z.object({ id, number: z.string() })), createdAt: iso,
})
/** src/models/account.ts:69-86 */
const AccountDTO = z.object({
  id, name: z.string(), kind: z.enum(C.ACCOUNT_KINDS), reference: n(z.string()), detail: n(z.string()),
  openingBalance: z.number(), openedOn: n(iso), isDefault: z.boolean(), archived: z.boolean(),
  balance: z.number(), received: z.number(), paidOut: z.number(), movements: z.number(), createdAt: iso,
})
/** src/models/schedule.ts:53-61 */
const ScheduleDTO = z.object({
  id, userId: id, day, kind: z.enum(C.SCHEDULE_KINDS), startTime: n(z.string()), endTime: n(z.string()), note: n(z.string()),
})
/** src/models/site.ts:183-223 */
const SiteContent = z.object({
  name: z.string(), tagline: n(z.string()), description: n(z.string()),
  hero: z.object({ headline: n(z.string()), sub: n(z.string()), ctaLabel: n(z.string()), ctaHref: n(z.string()), image: n(z.string()) }),
  about: z.object({ title: n(z.string()), body: n(z.string()), image: n(z.string()) }),
  services: z.array(z.object({ title: z.string(), body: n(z.string()) })),
  products: z.array(z.object({ name: z.string(), blurb: n(z.string()), price: n(z.string()), image: n(z.string()) })),
  gallery: z.array(z.object({ url: z.string(), caption: n(z.string()) })),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
  contact: z.object({ email: n(z.string()), phone: n(z.string()), address: n(z.string()), hours: n(z.string()), mapUrl: n(z.string()) }),
})
const SiteDTO = z.object({
  id, slug: z.string(), template: z.string(), published: z.boolean(), publishedAt: n(iso),
  content: SiteContent, extraSlots: z.record(z.string(), z.string()), updatedAt: iso,
})
/** src/lib/reports.ts:323-357 */
const ReportPayload = z.object({
  slug: z.string(),
  columns: z.array(z.object({
    key: z.string(), label: z.string(), align: z.enum(["left", "right"]).optional(),
    format: z.enum(["text", "number", "money", "day", "month"]).optional(),
  })),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  totals: z.array(z.object({ label: z.string(), value: z.string() })),
  stats: z.array(z.object({ label: z.string(), value: z.string(), accent: z.boolean().optional() })),
  chart: z.object({
    kind: z.enum(["bar", "column"]), labels: z.array(z.string()),
    series: z.array(z.object({ label: z.string(), values: z.array(z.number()) })),
    format: z.enum(["money", "number"]), caption: z.string().optional(),
  }).optional(),
  note: z.string().optional(),
})
/** src/lib/admin.ts:6-38 */
const AdminBusiness = z.object({
  id, name: z.string(), crewSize: z.string(), timeZone: z.string(), blockedAt: n(iso), createdAt: iso,
  owner: n(z.object({ name: z.string(), email: z.string() })),
  counts: z.object({ users: z.number(), projects: z.number(), tickets: z.number(), bills: z.number(), items: z.number() }),
})
const AdminUser = z.object({
  id, name: z.string(), email: z.string(), phone: z.string(), role: z.string(), status: z.string(),
  blockedAt: n(iso), superAdmin: z.boolean(), createdAt: iso,
  business: n(z.object({ id, name: z.string(), blockedAt: n(iso) })),
})
const AdminProject = z.object({
  id, name: z.string(), site: n(z.string()), status: z.string(), createdAt: iso,
  business: n(named), tickets: z.number(),
})

const ApiError = z.object({
  error: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional().describe("Keyed by form path, e.g. \"lines.0.qty\""),
})

// ---- responses per route (shapes from the route handlers) -----------------

const R = {
  ticketList: z.object({ tickets: z.array(TicketDTO) }),
  ticket: z.object({ ticket: TicketDTO }),
  ticketDetail: z.object({ ticket: TicketDTO, history: z.array(CheckInDTO).max(50) }),
  checkInResult: z.object({ ticket: TicketDTO, checkIn: CheckInDTO, attendance: AttendanceDTO }),
  attendanceMonth: z.object({
    month: z.string(), today: day, timeZone: z.string(), week: n(WeekPattern), days: z.array(AttendanceDTO),
    summary: z.object({ present: z.number(), late: z.number(), leave: z.number(), absent: z.number() }),
  }),
  attendance: z.object({ attendance: AttendanceDTO }),
  crewDay: z.object({
    day, today: day, timeZone: z.string(),
    rows: z.array(z.object({
      user: z.object({ id, name: z.string(), role: z.string(), shift: n(z.string()), removed: z.boolean(), resting: z.boolean(), week: n(WeekPattern) }),
      attendance: n(AttendanceDTO),
    })),
    summary: z.object({ crew: z.number(), present: z.number(), resting: z.number(), absent: z.number(), late: z.number(), leave: z.number(), away: z.number(), stillIn: z.number() }),
  }),
  visits: z.object({
    day, today: day, timeZone: z.string(),
    visits: z.array(z.object({
      id, type: z.enum(["in", "out"]), at: iso, user: named,
      ticket: z.object({ id, title: z.string(), site: z.string() }),
      lat: z.number(), lng: z.number(), accuracyM: n(z.number()), distanceM: z.number(), insideFence: z.boolean(), reason: n(z.string()),
    })),
    summary: z.object({ total: z.number(), arrivals: z.number(), departures: z.number(), outside: z.number(), people: z.number() }),
  }),
  requestList: z.object({
    requests: z.array(RequestDTO),
    counts: z.object({ pending: z.number(), approved: z.number(), rejected: z.number() }),
  }),
  request: z.object({ request: RequestDTO }),
  projectList: z.object({ projects: z.array(ProjectWithCounts) }),
  project: z.object({ project: ProjectDTO }),
  members: z.object({ members: z.array(UserDTO) }),
  member: z.object({ member: UserDTO }),
  memberRemoved: z.object({ member: UserDTO, cancelledTickets: z.number() }),
  business: z.object({ business: BusinessDTO }),
  notifications: z.object({ notifications: z.array(NotificationDTO).max(100), unread: z.number() }),
  unreadCount: z.object({ unread: z.number() }),
  marked: z.object({ marked: z.number(), unread: z.number() }),
  activity: z.object({
    day, today: day, timeZone: z.string(), entries: z.array(ActivityDTO).max(500),
    summary: z.object({ total: z.number(), people: z.number() }),
  }),
  calendar: z.object({
    month: z.string(), today: day, timeZone: z.string(),
    items: z.array(z.object({
      id, source: z.enum(["operation", "ticket"]), kind: z.string(), title: z.string(), day,
      startAt: iso, endAt: n(iso), allDay: z.boolean(), status: z.string(), priority: z.string(),
      people: z.array(z.string()), where: n(z.string()),
    })),
    summary: z.object({ total: z.number(), operations: z.number(), tickets: z.number() }),
  }),
  geocode: z.object({
    results: z.array(z.object({ label: z.string(), lat: z.number(), lng: z.number() })),
    unavailable: z.boolean().optional(),
  }),
  billList: z.object({ bills: z.array(BillDTO) }),
  bill: z.object({ bill: BillDTO }),
  billShared: z.object({ bill: BillDTO, url: z.string().describe(`${BASE}/quote/<token>`) }),
  quote: z.object({ quote: PublicQuote }),
  customers: z.object({ customers: z.array(CustomerDTO) }),
  customer: z.object({ customer: CustomerDTO }),
  ledger: z.object({ party: CustomerDTO, ledger: PartyLedger }),
  deletedId: z.object({ id }),
  expenses: z.object({ expenses: z.array(ExpenseDTO) }),
  expense: z.object({ expense: ExpenseDTO }),
  categories: z.object({ categories: z.array(CategoryWithCount) }),
  category: z.object({ category: CategoryDTO }),
  items: z.object({ items: z.array(ItemDTO), uploads: z.boolean() }),
  item: z.object({ item: ItemDTO }),
  maintenanceList: z.object({ items: z.array(MaintenanceDTO), uploads: z.boolean() }),
  maintenance: z.object({ item: MaintenanceDTO }),
  operationsList: z.object({ operations: z.array(OperationDTO) }),
  operation: z.object({ operation: OperationDTO }),
  payments: z.object({ payments: z.array(PaymentDTO) }),
  payment: z.object({ payment: PaymentDTO }),
  accounts: z.object({ accounts: z.array(AccountDTO) }),
  account: z.object({ account: AccountDTO }),
  accountDeleted: z.object({ id, archived: z.boolean(), movements: z.number() }),
  schedules: z.object({
    from: day, days: z.array(day).length(7), today: day, timeZone: z.string(),
    crew: z.array(z.object({ id, name: z.string(), role: z.string(), shift: n(z.string()), week: n(WeekPattern) })),
    entries: z.array(ScheduleDTO),
  }),
  schedule: z.object({ entry: ScheduleDTO }),
  report: z.union([
    ReportPayload.extend({ blocked: z.literal(false) }),
    z.object({ slug: z.string(), blocked: z.literal(true), missing: z.string().optional(), unlock: z.array(z.string()).optional() }),
  ]),
  reportGroup: z.object({
    group: z.enum(["sales", "inventory", "finance", "employee"]),
    reports: z.array(z.object({
      slug: z.string(), title: z.string(), subtitle: z.string(), status: z.enum(["ready", "partial", "blocked"]),
      missing: z.string().optional(), chart: n(ReportPayload.shape.chart.unwrap()),
      stats: z.array(z.object({ label: z.string(), value: z.string(), accent: z.boolean().optional() })).max(2),
      rows: z.number(),
    })),
  }),
  adminOverview: z.object({
    businesses: z.array(AdminBusiness), users: z.array(AdminUser), projects: z.array(AdminProject),
    invites: z.array(WorkspaceInviteDTO),
  }),
  adminUser: z.object({ user: UserDTO }),
  workspaceInvite: z.object({ invite: WorkspaceInviteDTO }),
  workspaceInviteCreated: z.object({ invite: WorkspaceInviteDTO, signupUrl: z.string().describe(`${BASE}/signup?invite=<token>`) }),
  site: z.object({ site: SiteDTO, uploads: z.boolean() }),
  siteSaved: z.object({ site: SiteDTO }),
  siteStale: z.object({ error: z.string(), code: z.literal("stale"), updatedAt: n(iso) }),
  registered: z.object({ user: UserDTO, business: BusinessDTO }),
  invites: z.object({ invites: z.array(InviteDTO) }),
  inviteCreated: z.object({ invite: InviteDTO, joinUrl: z.string().describe(`${BASE}/join/<token>`) }),
  pendingInvite: z.object({ invite: PendingInvite }),
  user: z.object({ user: UserDTO }),
  uploaded: z.object({ key: z.string(), url: z.string().describe("Served URL (CDN when AWS_PUBLIC_BASE_URL is set)") }),
  uploadsDeleted: z.object({ deleted: z.number(), refused: z.number() }),
  csrf: z.object({ csrfToken: z.string() }),
  session: n(z.object({
    user: z.object({
      id, name: z.string().optional(), email: z.string().optional(), role: z.enum(["owner", "supervisor", "employee"]),
      businessId: id, superAdmin: z.boolean(), signedInAt: z.number().optional(),
    }),
    expires: iso,
  })),
  providers: z.record(z.string(), z.object({ id: z.string(), name: z.string(), type: z.string(), signinUrl: z.string(), callbackUrl: z.string() })),
  authRefusal: z.object({ error: z.string(), url: z.string() }),
}

// ---- conversion -------------------------------------------------------------

// Two registries: request bodies are converted as their *input* type (what the
// client sends, before transforms), responses as their *output* type. Shared
// DTOs are registered by name so every wrapper $refs one component.
const registries = { input: z.registry(), output: z.registry() }
const registered = new Map()
function ref(name, schema, io) {
  const seen = registered.get(name)
  if (seen && seen !== schema) throw new Error(`Two schemas registered as ${name}`)
  if (!seen) {
    registries[io].add(schema, { id: name })
    registered.set(name, schema)
  }
  return { $ref: `#/components/schemas/${name}` }
}
for (const [name, schema] of Object.entries({
  ApiError, WeekPattern, TicketDTO, CheckInDTO, AttendanceDTO, UserDTO, BusinessDTO, InviteDTO, PendingInvite,
  WorkspaceInviteDTO, RequestDTO, ProjectDTO, ProjectWithCounts, NotificationDTO, ActivityDTO, BillDTO, PublicQuote,
  CustomerDTO, PartyLedger, ExpenseDTO, CategoryDTO, CategoryWithCount, ItemDTO, MaintenanceDTO, OperationDTO,
  PaymentDTO, AccountDTO, ScheduleDTO, SiteContent, SiteDTO, ReportPayload, AdminBusiness, AdminUser, AdminProject,
})) ref(name, schema, "output")
const components = { schemas: {} }

// ---- operations ---------------------------------------------------------------

const ERR = {
  400: "Bad request (malformed JSON, missing body, or a route-specific refusal)",
  401: "Sign in to continue (no session, or a session older than sessionsValidAfter)",
  403: "Forbidden (role, removed/blocked account, cross-origin mutation, or a route rule)",
  404: "Not found (also any malformed id: CastError -> 404)",
  405: "Method not allowed",
  409: "Conflict (state rule, duplicate, or unique index)",
  410: "Gone",
  411: "Length required",
  413: "Body too large",
  415: "Unsupported media type",
  422: "Validation failed (fieldErrors keyed by path)",
  429: "Rate limited (Retry-After header)",
  500: "Something went wrong",
  503: "File storage isn't configured",
}

const paths = {}
function op(method, path, o) {
  const params = []
  for (const name of (path.match(/\{(\w+)\}/g) ?? []).map((s) => s.slice(1, -1))) {
    params.push({ name, in: "path", required: true, schema: { type: "string" } })
  }
  for (const q of o.query ?? []) {
    params.push({ name: q.name, in: "query", required: false, description: q.description, schema: q.schema ?? { type: "string" } })
  }
  const responses = {}
  for (const [status, [name, schema]] of Object.entries(o.ok)) {
    responses[status] = { description: "Success", content: { "application/json": { schema: ref(name, schema, "output") } } }
  }
  for (const status of o.errors ?? []) {
    responses[status] = { description: ERR[status], content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } }
  }
  for (const [status, extra] of Object.entries(o.extraResponses ?? {})) responses[status] = extra
  const operation = {
    tags: [o.tag],
    summary: o.summary,
    operationId: o.operationId,
    "x-source": o.source,
    "x-roles": o.roles,
    security: o.roles === "public" ? [] : [{ sessionCookie: [] }],
    parameters: params.length ? params : undefined,
    responses,
  }
  if (o.body) {
    const [name, schema, type = "application/json"] = o.body
    operation.requestBody = { required: true, content: { [type]: { schema: ref(name, schema, "input") } } }
  }
  if (o.rateLimit) operation["x-rate-limit"] = o.rateLimit
  if (o.refinements) operation["x-refinements"] = o.refinements
  if (o.sideEffects) operation["x-side-effects"] = o.sideEffects
  if (o.note) operation.description = o.note
  ;(paths[path] ??= {})[method] = operation
}

const MUT = "mutation: 300 / 10 min per session cookie (src/proxy.ts:124-140, src/lib/security/limits.ts:23)"
const OWNER = ["owner"]
const OS = ["owner", "supervisor"]
const ALL = ["owner", "supervisor", "employee"]
const JSONERR = [400, 401, 403, 413, 422, 429, 500]

// Auth.js ---------------------------------------------------------------------
op("get", "/api/auth/csrf", {
  tag: "auth", summary: "Auth.js CSRF token (sets __Host-authjs.csrf-token cookie)", operationId: "authCsrf",
  source: "src/app/api/auth/[...nextauth]/route.ts:28-31", roles: "public", ok: { 200: ["CsrfResponse", R.csrf] }, errors: [404],
})
op("get", "/api/auth/session", {
  tag: "auth", summary: "Current session, or null", operationId: "authSession",
  source: "src/app/api/auth/[...nextauth]/route.ts:28-31; claims src/auth.config.ts:46-53", roles: "public",
  ok: { 200: ["SessionResponse", R.session] }, errors: [404],
})
op("get", "/api/auth/providers", {
  tag: "auth", summary: "Configured providers (credentials only)", operationId: "authProviders",
  source: "src/app/api/auth/[...nextauth]/route.ts:28-31", roles: "public", ok: { 200: ["ProvidersResponse", R.providers] }, errors: [404],
})
op("post", "/api/auth/callback/credentials", {
  tag: "auth", summary: "Sign in with email + password (Auth.js credentials); success sets __Secure-authjs.session-token",
  operationId: "authSignIn", source: "src/app/api/auth/[...nextauth]/route.ts:33-80; authorize src/auth.ts:20-59", roles: "public",
  body: ["CredentialsForm", credentialsForm, "application/x-www-form-urlencoded"],
  ok: { 200: ["AuthRefusal", R.authRefusal] },
  extraResponses: {
    302: { description: "Auth.js redirect (success -> callbackUrl, failure -> /login?error=CredentialsSignin) unless redirect=false" },
    422: { description: "email/password not strings", content: { "application/json": { schema: ref("AuthRefusal", R.authRefusal, "output") } } },
    429: { description: "loginEmail 5/15 min or loginIp 20/15 min", content: { "application/json": { schema: ref("AuthRefusal", R.authRefusal, "output") } } },
  },
  errors: [404],
  rateLimit: "loginEmail 5 / 15 min per email; loginIp 20 / 15 min per IP (src/lib/security/limits.ts:7-9)",
  sideEffects: ["activity: login_succeeded | login_failed | login_rate_limited (route.ts:65,77)"],
  note: "Not in the proxy matcher, so no Origin check; Auth.js' own double-submit CSRF token applies. Web-cookie flow; see backend-gaps.md for the proposed token login.",
})
op("post", "/api/auth/signout", {
  tag: "auth", summary: "Sign out (clears the session cookie)", operationId: "authSignOut",
  source: "src/app/api/auth/[...nextauth]/route.ts:33-37", roles: "public",
  body: ["SignoutForm", signoutForm, "application/x-www-form-urlencoded"],
  ok: { 200: ["AuthRefusal", R.authRefusal] }, extraResponses: { 302: { description: "Redirect to callbackUrl" } }, errors: [404],
})

// Onboarding ------------------------------------------------------------------
op("post", "/api/register", {
  tag: "onboarding", summary: "Open a workspace + owner account against a super-admin invite", operationId: "register",
  source: "src/app/api/register/route.ts:38-168", roles: "public",
  body: ["SignupRequest", auth.signupSchema], ok: { 201: ["RegisterResponse", R.registered] },
  errors: [400, 403, 404, 409, 413, 422, 429, 500],
  rateLimit: "register 5 / hour per IP (route.ts:41) + " + MUT,
  refinements: ["terms must be true (validations/auth.ts:157-159)"],
})
op("get", "/api/invites", {
  tag: "people", summary: "Live (unaccepted) crew invites", operationId: "listInvites",
  source: "src/app/api/invites/route.ts:19-33", roles: OWNER, ok: { 200: ["InviteList", R.invites] }, errors: [401, 403, 500],
})
op("post", "/api/invites", {
  tag: "people", summary: "Invite a supervisor/employee; returns the one-time join URL", operationId: "createInvite",
  source: "src/app/api/invites/route.ts:39-95", roles: OWNER, body: ["InviteRequest", auth.inviteSchema],
  ok: { 201: ["InviteCreated", R.inviteCreated] }, errors: [...JSONERR, 409], rateLimit: MUT,
  refinements: ["shiftEnd > shiftStart (validations/auth.ts:174-177)"],
})
op("get", "/api/invites/{token}", {
  tag: "onboarding", summary: "Who a crew invite is for (public)", operationId: "getInvite",
  source: "src/app/api/invites/[token]/route.ts:7-17; src/lib/auth/invites.ts:23-52", roles: "public",
  ok: { 200: ["PendingInviteResponse", R.pendingInvite] }, errors: [404, 500],
})
op("post", "/api/invites/{token}/accept", {
  tag: "onboarding", summary: "Accept a crew invite (sets the password, creates/adopts the account)", operationId: "acceptInvite",
  source: "src/app/api/invites/[token]/accept/route.ts:22-126", roles: "public", body: ["AcceptInviteRequest", auth.acceptInviteSchema],
  ok: { 201: ["UserResponse", R.user] }, errors: [400, 403, 404, 409, 413, 422, 429, 500],
  rateLimit: "inviteAccept 5 / hour per IP (route.ts:28) + " + MUT,
  refinements: ["terms must be true (validations/auth.ts:184-186)"],
  sideEffects: ["activity member_joined", "notify owners+supervisors member_joined"],
})

// Uploads ---------------------------------------------------------------------
op("post", "/api/uploads", {
  tag: "uploads", summary: "Upload one picture (multipart)", operationId: "upload",
  source: "src/app/api/uploads/route.ts:58-130", roles: ALL, body: ["UploadForm", uploadForm, "multipart/form-data"],
  ok: { 201: ["UploadResponse", R.uploaded] }, errors: [400, 401, 403, 404, 410, 411, 413, 415, 429, 500, 503],
  rateLimit: "uploads 60 / 10 min per user (route.ts:64). Not in the proxy matcher: no mutation limit.",
  note: "Roles per purpose (route.ts:27-31): owner site|maintenance|ticket|products|logo; supervisor maintenance|ticket|products; employee ticket. Content-Length required (411) and <= 1,000,000 + 64 KiB (413) before reading (src/lib/storage/http.ts:30-45).",
  sideEffects: ["S3 PutObject businesses/{businessId}/{purpose}/{uuid}.{ext}, Cache-Control immutable (src/lib/storage/s3.ts:58,273-301)"],
})
op("delete", "/api/uploads", {
  tag: "uploads", summary: "Delete orphaned uploads (own-images rule)", operationId: "deleteUploads",
  source: "src/app/api/uploads/route.ts:144-212", roles: ALL, body: ["DeleteUploadsRequest", uploads.deleteUploadSchema],
  ok: { 200: ["UploadsDeleted", R.uploadsDeleted] }, errors: [400, 401, 403, 404, 413, 422, 500],
  sideEffects: ["S3 DeleteObject", "activity image_deleted for pictures a record pointed at"],
})

// Tickets ---------------------------------------------------------------------
op("get", "/api/tickets", {
  tag: "tickets", summary: "Tickets (employees: only their own)", operationId: "listTickets",
  source: "src/app/api/tickets/route.ts:34-99", roles: ALL,
  query: [
    { name: "scope", description: "today|in_progress|in_review|upcoming|done|all|mine (default all)", schema: { type: "string", enum: ["today", "in_progress", "in_review", "upcoming", "done", "all", "mine"] } },
    { name: "assigneeId", description: "owner/supervisor only; ignored for employees" },
    { name: "projectId" },
  ],
  ok: { 200: ["TicketList", R.ticketList] }, errors: [401, 403, 500],
  note: "Max 200, sorted startAt asc (desc for done/mine).",
})
op("post", "/api/tickets", {
  tag: "tickets", summary: "Create a ticket", operationId: "createTicket", source: "src/app/api/tickets/route.ts:102-183",
  roles: OS, body: ["TicketRequest", work.ticketSchema], ok: { 201: ["TicketResponse", R.ticket] }, errors: JSONERR, rateLimit: MUT,
  refinements: ["endAt > startAt (validations/work.ts:44-47)"],
  sideEffects: ["activity ticket_created", "notify each assignee ticket_assigned (except the creator)"],
})
op("get", "/api/tickets/{id}", {
  tag: "tickets", summary: "One ticket + last 50 check-ins", operationId: "getTicket", source: "src/app/api/tickets/[id]/route.ts:15-40",
  roles: ALL, ok: { 200: ["TicketDetail", R.ticketDetail] }, errors: [401, 403, 404, 500],
})
op("patch", "/api/tickets/{id}", {
  tag: "tickets", summary: "Edit a ticket (full body)", operationId: "updateTicket", source: "src/app/api/tickets/[id]/route.ts:46-144",
  roles: OS, body: ["TicketRequest", work.ticketSchema], ok: { 200: ["TicketResponse", R.ticket] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["endAt > startAt (validations/work.ts:44-47)"],
  sideEffects: ["activity ticket_updated", "notify newly added assignees ticket_assigned"],
})
op("patch", "/api/tickets/{id}/status", {
  tag: "tickets", summary: "Move a ticket (assignee: in_progress|blocked|in_review; reviewers: any)", operationId: "setTicketStatus",
  source: "src/app/api/tickets/[id]/status/route.ts:45-257", roles: ALL, body: ["TicketStatusRequest", work.ticketStatusSchema],
  ok: { 200: ["TicketResponse", R.ticket] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["status=blocked requires blockedReason >= 3 chars (validations/work.ts:137-142)", "employee in_review needs >= 1 own photo; <= 5 own photos (status/route.ts:111-132)"],
  sideEffects: ["closes the actor's open visit on in_review/done -> attendance markDeparture", "S3 delete of the actor's dropped photos", "activity ticket_status", "notify: blocked/in_review/done -> owners+supervisors; reviewer done -> crew"],
})
op("post", "/api/tickets/{id}/check-in", {
  tag: "tickets", summary: "Check in at the ticket site (server measures the geofence)", operationId: "checkIn",
  source: "src/app/api/tickets/[id]/check-in/route.ts:31-198", roles: ["employee", "supervisor"], body: ["CheckInRequest", work.checkInSchema],
  ok: { 201: ["CheckInResult", R.checkInResult] }, errors: [...JSONERR, 404, 409],
  rateLimit: "checkIn 30 / 10 min per user (route.ts:37) + " + MUT,
  refinements: ["reason required when outside ticket.radiusM (route.ts:98-102)", "overtimeReason required outside the shift (route.ts:103-105)"],
  sideEffects: ["CheckIn row", "ticket pending|blocked -> in_progress", "attendance markArrival (derived)", "activity ticket_checked_in", "notify owners+supervisors check_in"],
})
op("post", "/api/tickets/{id}/check-out", {
  tag: "tickets", summary: "Check out of the ticket site", operationId: "checkOut",
  source: "src/app/api/tickets/[id]/check-out/route.ts:26-167", roles: ["employee", "supervisor"], body: ["CheckInRequest", work.checkInSchema],
  ok: { 201: ["CheckInResult", R.checkInResult] }, errors: [...JSONERR, 404, 409],
  rateLimit: "checkIn 30 / 10 min per user (route.ts:32) + " + MUT,
  refinements: ["overtimeReason required after the shift end or on a rest day (route.ts:68-73)"],
  sideEffects: ["CheckIn row", "attendance markDeparture", "activity ticket_checked_out", "notify owners+supervisors check_out"],
})
op("put", "/api/tickets/{id}/materials", {
  tag: "tickets", summary: "Replace the materials-used list", operationId: "setTicketMaterials",
  source: "src/app/api/tickets/[id]/materials/route.ts:29-111", roles: ALL, body: ["TicketMaterialsRequest", work.ticketMaterialsSchema],
  ok: { 200: ["TicketResponse", R.ticket] }, errors: [...JSONERR, 404], rateLimit: MUT,
  sideEffects: ["activity ticket_updated (does not move stock)"],
})

// Attendance ------------------------------------------------------------------
op("get", "/api/attendance", {
  tag: "attendance", summary: "A month of one person's attendance", operationId: "getAttendance",
  source: "src/app/api/attendance/route.ts:30-90", roles: ALL,
  query: [{ name: "month", description: "YYYY-MM (default: this month)" }, { name: "userId", description: "owner/supervisor only" }],
  ok: { 200: ["AttendanceMonth", R.attendanceMonth] }, errors: [401, 403, 404, 500],
  sideEffects: ["auto-closes finished shifts before reading (route.ts:57-61)"],
})
op("post", "/api/attendance", {
  tag: "attendance", summary: "Start / end shift", operationId: "shiftAction", source: "src/app/api/attendance/route.ts:93-221",
  roles: ALL, body: ["AttendanceActionRequest", work.attendanceActionSchema], ok: { 201: ["AttendanceResponse", R.attendance] },
  errors: [...JSONERR, 409], rateLimit: MUT,
  refinements: ["with an office: start needs lat/lng (400, route.ts:117-124); beyond awayRadiusM needs reason (409, route.ts:134-139)"],
  sideEffects: ["attendance markArrival/markDeparture (manual)", "activity shift_started|shift_ended"],
})
op("get", "/api/attendance/crew", {
  tag: "attendance", summary: "One day of the whole crew", operationId: "crewAttendance", source: "src/app/api/attendance/crew/route.ts:23-107",
  roles: OS, query: [{ name: "day", description: "YYYY-MM-DD (default today)" }], ok: { 200: ["CrewDay", R.crewDay] }, errors: [401, 403, 500],
})
op("get", "/api/attendance/visits", {
  tag: "attendance", summary: "One day of ticket check-ins/outs", operationId: "visits", source: "src/app/api/attendance/visits/route.ts:21-78",
  roles: OS, query: [{ name: "day", description: "YYYY-MM-DD (default today)" }], ok: { 200: ["Visits", R.visits] }, errors: [401, 403, 500],
})

// Requests --------------------------------------------------------------------
op("get", "/api/requests", {
  tag: "requests", summary: "Requests (employees: own)", operationId: "listRequests", source: "src/app/api/requests/route.ts:15-49",
  roles: ALL, query: [{ name: "status", description: "pending|approved|rejected" }], ok: { 200: ["RequestList", R.requestList] }, errors: [401, 403, 500],
})
op("post", "/api/requests", {
  tag: "requests", summary: "Raise leave / advance / material request", operationId: "createRequest", source: "src/app/api/requests/route.ts:52-120",
  roles: ["employee", "supervisor"], body: ["RequestRequest", work.requestSchemaChecked], ok: { 201: ["RequestResponse", R.request] },
  errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["leave: endDate >= startDate (validations/work.ts:191-194)", "one pending request per kind (409, route.ts:68-79)"],
  sideEffects: ["activity request_raised", "notify owners+supervisors request_raised"],
})
op("patch", "/api/requests/{id}", {
  tag: "requests", summary: "Approve / reject", operationId: "decideRequest", source: "src/app/api/requests/[id]/route.ts:20-90",
  roles: OWNER, body: ["RequestDecision", work.requestDecisionSchema], ok: { 200: ["RequestResponse", R.request] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  sideEffects: ["approved leave writes attendance status=leave per day (route.ts:96-123)", "activity request_decided", "notify requester request_decided"],
})

// Projects --------------------------------------------------------------------
op("get", "/api/projects", {
  tag: "projects", summary: "Projects with ticket counts", operationId: "listProjects", source: "src/app/api/projects/route.ts:17-63",
  roles: ALL, query: [{ name: "status", description: "active|archived" }], ok: { 200: ["ProjectList", R.projectList] }, errors: [401, 403, 500],
})
op("post", "/api/projects", {
  tag: "projects", summary: "Create a project", operationId: "createProject", source: "src/app/api/projects/route.ts:66-98",
  roles: OS, body: ["ProjectRequest", work.projectSchema], ok: { 201: ["ProjectResponse", R.project] }, errors: [...JSONERR, 409], rateLimit: MUT,
  sideEffects: ["activity project_created"],
})
op("patch", "/api/projects/{id}", {
  tag: "projects", summary: "Edit, or archive/reopen ({status})", operationId: "updateProject", source: "src/app/api/projects/[id]/route.ts:15-90",
  roles: OS, body: ["ProjectUpdateRequest", work.projectUpdateSchema], ok: { 200: ["ProjectResponse", R.project] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  sideEffects: ["archive cancels pending tickets (route.ts:43-48)", "activity project_archived|project_reopened|project_updated"],
})

// People & business -----------------------------------------------------------
op("get", "/api/people", {
  tag: "people", summary: "Workspace members", operationId: "listPeople", source: "src/app/api/people/route.ts:9-28",
  roles: OS, query: [{ name: "includeRemoved", description: "1 to include removed members" }], ok: { 200: ["MemberList", R.members] }, errors: [401, 403, 500],
})
op("patch", "/api/people/{id}", {
  tag: "people", summary: "Edit a member", operationId: "updateMember", source: "src/app/api/people/[id]/route.ts:15-95",
  roles: OWNER, body: ["MemberUpdateRequest", auth.memberUpdateSchema], ok: { 200: ["MemberResponse", R.member] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["shiftEnd > shiftStart when both set (validations/auth.ts:228-234)"],
  sideEffects: ["activity member_updated (+ role_changed)"],
})
op("delete", "/api/people/{id}", {
  tag: "people", summary: "Remove a member (soft)", operationId: "removeMember", source: "src/app/api/people/[id]/route.ts:102-178",
  roles: OWNER, ok: { 200: ["MemberRemoved", R.memberRemoved] }, errors: [401, 403, 404, 409, 429, 500], rateLimit: MUT,
  sideEffects: ["status=removed", "cancels their pending tickets", "activity member_removed"],
})
op("patch", "/api/business", {
  tag: "settings", summary: "Workspace settings (name, zone, VAT, office, week, logo)", operationId: "updateBusiness",
  source: "src/app/api/business/route.ts:13-104", roles: OWNER, body: ["BusinessSettingsRequest", auth.businessSettingsSchema],
  ok: { 200: ["BusinessResponse", R.business] }, errors: JSONERR, rateLimit: MUT,
  refinements: ["office.awayRadiusM >= office.radiusM (validations/auth.ts:35-38)", "week: working day needs start < end (validations/auth.ts:59-66)", "timeZone must be a known IANA zone (validations/auth.ts:196-198)"],
  sideEffects: ["replaced logo deleted from S3 (route.ts:84-86)", "activity logo_changed"],
})

// Notifications / activity / calendar / geocode ------------------------------
op("get", "/api/notifications", {
  tag: "notifications", summary: "Own feed (count=1 for just the unread number)", operationId: "listNotifications",
  source: "src/app/api/notifications/route.ts:12-52", roles: ALL,
  query: [{ name: "count", description: "1 -> {unread}" }, { name: "unread", description: "1 -> unread only" }],
  ok: { 200: ["NotificationList", R.notifications] }, errors: [401, 403, 500],
})
op("post", "/api/notifications", {
  tag: "notifications", summary: "Mark one ({id}) or all ({}) read", operationId: "markNotifications",
  source: "src/app/api/notifications/route.ts:63-96", roles: ALL, body: ["MarkNotificationsRequest", markNotificationsSchema],
  ok: { 200: ["MarkedResponse", R.marked] }, errors: [401, 403, 413, 422, 429, 500], rateLimit: MUT,
})
op("get", "/api/activity", {
  tag: "activity", summary: "One day of the audit log", operationId: "activity", source: "src/app/api/activity/route.ts:20-54",
  roles: OWNER, query: [{ name: "day", description: "YYYY-MM-DD" }], ok: { 200: ["ActivityDay", R.activity] }, errors: [401, 403, 500],
})
op("get", "/api/calendar", {
  tag: "operations", summary: "A month of operations + tickets", operationId: "calendar", source: "src/app/api/calendar/route.ts:21-112",
  roles: OS, query: [{ name: "month", description: "YYYY-MM" }], ok: { 200: ["CalendarMonth", R.calendar] }, errors: [401, 403, 500],
})
op("get", "/api/geocode", {
  tag: "tickets", summary: "Place search (Nominatim proxy, cached 1 day)", operationId: "geocode", source: "src/app/api/geocode/route.ts:23-70",
  roles: OS, query: [{ name: "q", description: ">= 3 chars, first 120 used" }], ok: { 200: ["GeocodeResponse", R.geocode] }, errors: [401, 403, 500],
})

// Sales -----------------------------------------------------------------------
op("get", "/api/bills", {
  tag: "sales", summary: "Bills, newest first (max 200)", operationId: "listBills", source: "src/app/api/bills/route.ts:17-35",
  roles: OS, ok: { 200: ["BillList", R.billList] }, errors: [401, 403, 500],
})
op("post", "/api/bills", {
  tag: "sales", summary: "Raise a bill / quotation", operationId: "createBill", source: "src/app/api/bills/route.ts:43-197",
  roles: OS, body: ["BillRequest", sales.billSchema], ok: { 201: ["BillResponse", R.bill] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["source=inventory: every line needs itemId (validations/sales.ts:58-64)"],
  sideEffects: ["Business.billSeq += 1 -> BILL-0001 numbering (route.ts:132-138)", "inventory stock decremented unless quotation (route.ts:140-154)"],
})
op("patch", "/api/bills/{id}", {
  tag: "sales", summary: "Settle ({payment}) or void ({status:'void'})", operationId: "updateBill", source: "src/app/api/bills/[id]/route.ts:22-159",
  roles: OS, body: ["BillUpdateRequest", sales.billUpdateSchema], ok: { 200: ["BillResponse", R.bill] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  sideEffects: ["stock moves when crossing quotation<->sale (route.ts:61-94)", "void returns stock (route.ts:136-145)"],
})
op("post", "/api/bills/{id}/review", {
  tag: "sales", summary: "Share a quotation (fresh token, returns /quote URL)", operationId: "shareQuote", source: "src/app/api/bills/[id]/review/route.ts:35-90",
  roles: OS, body: ["InviteReviewRequest", review.inviteReviewSchema], ok: { 200: ["BillShared", R.billShared] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  sideEffects: ["activity quote_shared"],
})
op("delete", "/api/bills/{id}/review", {
  tag: "sales", summary: "Revoke a shared quotation link", operationId: "revokeQuote", source: "src/app/api/bills/[id]/review/route.ts:93-131",
  roles: OWNER, ok: { 200: ["BillResponse", R.bill] }, errors: [401, 403, 404, 409, 429, 500], rateLimit: MUT,
  sideEffects: ["activity quote_revoked"],
})
op("get", "/api/quote/{token}", {
  tag: "public", summary: "A shared quotation (token is the credential)", operationId: "getQuote", source: "src/app/api/quote/[token]/route.ts:20-33",
  roles: "public", ok: { 200: ["QuoteResponse", R.quote] }, errors: [404, 429, 500],
  rateLimit: "publicPage 120 / min per IP (src/proxy.ts:125-130)",
})
op("post", "/api/quote/{token}", {
  tag: "public", summary: "Client remark and/or decision", operationId: "reviewQuote", source: "src/app/api/quote/[token]/route.ts:42-131",
  roles: "public", body: ["ClientReviewRequest", review.clientReviewSchema], ok: { 200: ["QuoteResponse", R.quote] },
  errors: [400, 403, 404, 413, 422, 429, 500], rateLimit: "publicPage 120 / min per IP",
  refinements: ["remark or decision required (validations/review.ts:53-56)"],
  sideEffects: ["notify owner (kind request_decided)", "activity quote_reviewed"],
})

// Customers -------------------------------------------------------------------
op("get", "/api/customers", {
  tag: "customers", summary: "Parties (customers/vendors), max 1000", operationId: "listCustomers", source: "src/app/api/customers/route.ts:11-24",
  roles: OS, ok: { 200: ["CustomerList", R.customers] }, errors: [401, 403, 500],
})
op("post", "/api/customers", {
  tag: "customers", summary: "Create a party", operationId: "createCustomer", source: "src/app/api/customers/route.ts:26-57",
  roles: OS, body: ["CustomerRequest", customers.customerSchema], ok: { 201: ["CustomerResponse", R.customer] }, errors: [...JSONERR, 409], rateLimit: MUT,
})
op("patch", "/api/customers/{id}", {
  tag: "customers", summary: "Edit a party", operationId: "updateCustomer", source: "src/app/api/customers/[id]/route.ts:12-52",
  roles: OS, body: ["CustomerRequest", customers.customerSchema], ok: { 200: ["CustomerResponse", R.customer] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
})
op("delete", "/api/customers/{id}", {
  tag: "customers", summary: "Delete a party", operationId: "deleteCustomer", source: "src/app/api/customers/[id]/route.ts:58-90",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["activity record_deleted"],
})
op("get", "/api/customers/{id}/ledger", {
  tag: "customers", summary: "A party's ledger with running balance", operationId: "customerLedger", source: "src/app/api/customers/[id]/ledger/route.ts:20-48",
  roles: OWNER, ok: { 200: ["LedgerResponse", R.ledger] }, errors: [401, 403, 404, 500],
})

// Expenses --------------------------------------------------------------------
op("get", "/api/expenses", {
  tag: "expenses", summary: "Expenses (supervisor: stock purchases only), max 500", operationId: "listExpenses", source: "src/app/api/expenses/route.ts:37-62",
  roles: OS, ok: { 200: ["ExpenseList", R.expenses] }, errors: [401, 403, 500],
})
op("post", "/api/expenses", {
  tag: "expenses", summary: "Record an expense (mirrored as a payment out)", operationId: "createExpense", source: "src/app/api/expenses/route.ts:73-207",
  roles: OS, body: ["ExpenseRequest", expenses.expenseSchema], ok: { 201: ["ExpenseResponse", R.expense] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["stock needs >= 1 line; non-stock no lines; non-stock amount > 0; no duplicate itemId (validations/expenses.ts:50-75)", "supervisor: kind must be stock (403)"],
  sideEffects: ["stock += qty, item costPrice recomputed", "Payment(out) mirror row", "activity expense_recorded"],
})
op("patch", "/api/expenses/{id}", {
  tag: "expenses", summary: "Edit an expense", operationId: "updateExpense", source: "src/app/api/expenses/[id]/route.ts:50-169",
  roles: OS, body: ["ExpenseRequest", expenses.expenseSchema], ok: { 200: ["ExpenseResponse", R.expense] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  sideEffects: ["stock delta applied, mirror payment updated, activity expense_updated"],
})
op("delete", "/api/expenses/{id}", {
  tag: "expenses", summary: "Delete an expense", operationId: "deleteExpense", source: "src/app/api/expenses/[id]/route.ts:177-231",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 409, 429, 500], rateLimit: MUT,
  sideEffects: ["stock taken back off, mirror payment deleted, activity expense_deleted"],
})

// Inventory -------------------------------------------------------------------
op("get", "/api/inventory/categories", {
  tag: "inventory", summary: "Categories with item counts", operationId: "listCategories", source: "src/app/api/inventory/categories/route.ts:18-46",
  roles: OS, ok: { 200: ["CategoryList", R.categories] }, errors: [401, 403, 500],
})
op("post", "/api/inventory/categories", {
  tag: "inventory", summary: "Create a category", operationId: "createCategory", source: "src/app/api/inventory/categories/route.ts:48-75",
  roles: OS, body: ["CategoryRequest", inventory.categorySchema], ok: { 201: ["CategoryResponse", R.category] }, errors: [...JSONERR, 409], rateLimit: MUT,
})
op("patch", "/api/inventory/categories/{id}", {
  tag: "inventory", summary: "Rename a category", operationId: "updateCategory", source: "src/app/api/inventory/categories/[id]/route.ts:16-52",
  roles: OS, body: ["CategoryRequest", inventory.categorySchema], ok: { 200: ["CategoryResponse", R.category] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
})
op("delete", "/api/inventory/categories/{id}", {
  tag: "inventory", summary: "Delete an empty category", operationId: "deleteCategory", source: "src/app/api/inventory/categories/[id]/route.ts:58-101",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 409, 429, 500], rateLimit: MUT, sideEffects: ["activity record_deleted"],
})
op("get", "/api/inventory/items", {
  tag: "inventory", summary: "All items (max 500) + uploads flag", operationId: "listItems", source: "src/app/api/inventory/items/route.ts:17-35",
  roles: OS, ok: { 200: ["ItemList", R.items] }, errors: [401, 403, 500],
})
op("post", "/api/inventory/items", {
  tag: "inventory", summary: "Create an item (images by uploaded URL, max 3)", operationId: "createItem", source: "src/app/api/inventory/items/route.ts:37-77",
  roles: OS, body: ["ItemRequest", inventory.itemSchema], ok: { 201: ["ItemResponse", R.item] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
})
op("patch", "/api/inventory/items/{id}", {
  tag: "inventory", summary: "Edit an item (images absent = unchanged)", operationId: "updateItem", source: "src/app/api/inventory/items/[id]/route.ts:40-121",
  roles: OS, body: ["ItemRequest", inventory.itemSchema], ok: { 200: ["ItemResponse", R.item] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  sideEffects: ["dropped pictures deleted from S3 if no other item uses them"],
})
op("delete", "/api/inventory/items/{id}", {
  tag: "inventory", summary: "Delete an item and its pictures", operationId: "deleteItem", source: "src/app/api/inventory/items/[id]/route.ts:128-168",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["S3 delete", "activity record_deleted"],
})

// Maintenance -----------------------------------------------------------------
op("get", "/api/maintenance", {
  tag: "maintenance", summary: "Repair bench (max 500) + uploads flag", operationId: "listMaintenance", source: "src/app/api/maintenance/route.ts:28-52",
  roles: OS, query: [{ name: "status", description: C.MAINTENANCE_STATUSES.join("|") }], ok: { 200: ["MaintenanceList", R.maintenanceList] }, errors: [401, 403, 500],
})
op("post", "/api/maintenance", {
  tag: "maintenance", summary: "Receive an item", operationId: "createMaintenance", source: "src/app/api/maintenance/route.ts:54-114",
  roles: OS, body: ["MaintenanceRequest", maintenance.maintenanceSchema], ok: { 201: ["MaintenanceResponse", R.maintenance] }, errors: [...JSONERR, 404], rateLimit: MUT,
  sideEffects: ["activity maintenance_received"],
})
op("patch", "/api/maintenance/{id}", {
  tag: "maintenance", summary: "Edit (full body)", operationId: "updateMaintenance", source: "src/app/api/maintenance/[id]/route.ts:25-104",
  roles: OS, body: ["MaintenanceRequest", maintenance.maintenanceSchema], ok: { 200: ["MaintenanceResponse", R.maintenance] }, errors: [...JSONERR, 404], rateLimit: MUT,
  sideEffects: ["dropped photos deleted from S3 (reconcileUploads)", "activity maintenance_updated|maintenance_status"],
})
op("delete", "/api/maintenance/{id}", {
  tag: "maintenance", summary: "Delete with photos", operationId: "deleteMaintenance", source: "src/app/api/maintenance/[id]/route.ts:107-141",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["S3 delete", "activity maintenance_deleted"],
})

// Operations / schedules ------------------------------------------------------
op("get", "/api/operations", {
  tag: "operations", summary: "Meetings / installations / follow-ups / deadlines", operationId: "listOperations", source: "src/app/api/operations/route.ts:30-67",
  roles: OS,
  query: [
    { name: "kind", description: C.OPERATION_KINDS.join("|") }, { name: "status", description: C.OPERATION_STATUSES.join("|") },
    { name: "from", description: "ISO date/instant, startAt >=" }, { name: "to", description: "ISO date/instant, startAt <" },
  ],
  ok: { 200: ["OperationList", R.operationsList] }, errors: [401, 403, 500],
})
op("post", "/api/operations", {
  tag: "operations", summary: "Create", operationId: "createOperation", source: "src/app/api/operations/route.ts:69-122",
  roles: OS, body: ["OperationRequest", operations.operationSchema], ok: { 201: ["OperationResponse", R.operation] }, errors: JSONERR, rateLimit: MUT,
  refinements: ["startAt parses; endAt > startAt (validations/operations.ts:40-50)"], sideEffects: ["activity operation_created"],
})
op("patch", "/api/operations/{id}", {
  tag: "operations", summary: "Full edit, or {status} only", operationId: "updateOperation", source: "src/app/api/operations/[id]/route.ts:23-123",
  roles: OS, body: ["OperationRequest", operations.operationSchema], ok: { 200: ["OperationResponse", R.operation] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  note: "A body with only {status} is validated by operationStatusSchema (validations/operations.ts:55-57).",
  sideEffects: ["activity operation_status|operation_updated"],
})
op("delete", "/api/operations/{id}", {
  tag: "operations", summary: "Delete", operationId: "deleteOperation", source: "src/app/api/operations/[id]/route.ts:125-164",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["activity operation_deleted"],
})
op("get", "/api/schedules", {
  tag: "operations", summary: "A week of the roster + crew", operationId: "schedules", source: "src/app/api/schedules/route.ts:21-60",
  roles: OS, query: [{ name: "from", description: "YYYY-MM-DD (week start)" }], ok: { 200: ["ScheduleWeek", R.schedules] }, errors: [401, 403, 500],
})
op("post", "/api/schedules", {
  tag: "operations", summary: "Upsert one person-day", operationId: "setSchedule", source: "src/app/api/schedules/route.ts:67-124",
  roles: OS, body: ["ScheduleRequest", operations.scheduleSchema], ok: { 201: ["ScheduleResponse", R.schedule] }, errors: [...JSONERR, 409], rateLimit: MUT,
  refinements: ["work/training/overtime need startTime < endTime (validations/operations.ts:72-101)"], sideEffects: ["activity schedule_set"],
})
op("delete", "/api/schedules/{id}", {
  tag: "operations", summary: "Clear one cell", operationId: "clearSchedule", source: "src/app/api/schedules/[id]/route.ts:15-52",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["activity schedule_cleared"],
})

// Payments / accounts ---------------------------------------------------------
op("get", "/api/payments", {
  tag: "payments", summary: "Money in/out (max 500)", operationId: "listPayments", source: "src/app/api/payments/route.ts:21-41",
  roles: OWNER, ok: { 200: ["PaymentList", R.payments] }, errors: [401, 403, 500],
})
op("post", "/api/payments", {
  tag: "payments", summary: "Record a payment (optionally against a bill)", operationId: "createPayment", source: "src/app/api/payments/route.ts:43-125",
  roles: OWNER, body: ["PaymentRequest", payments.paymentSchema], ok: { 201: ["PaymentResponse", R.payment] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
  refinements: ["billId only with direction=in (validations/payments.ts:39-42)"], sideEffects: ["bill payment flag re-synced (lib/payments.ts:32-59)"],
})
op("delete", "/api/payments/{id}", {
  tag: "payments", summary: "Delete a payment", operationId: "deletePayment", source: "src/app/api/payments/[id]/route.ts:16-50",
  roles: OWNER, ok: { 200: ["DeletedId", R.deletedId] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["bill re-synced", "activity record_deleted"],
})
op("get", "/api/accounts", {
  tag: "payments", summary: "Bank / wallet / cash accounts with balances", operationId: "listAccounts", source: "src/app/api/accounts/route.ts:18-38",
  roles: OWNER, ok: { 200: ["AccountList", R.accounts] }, errors: [401, 403, 500],
})
op("post", "/api/accounts", {
  tag: "payments", summary: "Create an account", operationId: "createAccount", source: "src/app/api/accounts/route.ts:40-83",
  roles: OWNER, body: ["AccountRequest", accounts.accountSchema], ok: { 201: ["AccountResponse", R.account] }, errors: [...JSONERR, 409], rateLimit: MUT,
})
op("patch", "/api/accounts/{id}", {
  tag: "payments", summary: "Edit an account", operationId: "updateAccount", source: "src/app/api/accounts/[id]/route.ts:24-69",
  roles: OWNER, body: ["AccountRequest", accounts.accountSchema], ok: { 200: ["AccountResponse", R.account] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
})
op("delete", "/api/accounts/{id}", {
  tag: "payments", summary: "Delete (or archive if used)", operationId: "deleteAccount", source: "src/app/api/accounts/[id]/route.ts:78-117",
  roles: OWNER, ok: { 200: ["AccountDeleted", R.accountDeleted] }, errors: [401, 403, 404, 429, 500], rateLimit: MUT, sideEffects: ["activity record_deleted (only when deleted)"],
})

// Reports ---------------------------------------------------------------------
const reportQuery = [
  { name: "from", description: "Date.parse-able; start of window" }, { name: "to", description: "Date.parse-able; whole day included" },
  { name: "employeeId" }, { name: "customerId" }, { name: "categoryId" }, { name: "payment", description: "bill payment filter" },
]
op("get", "/api/reports/{report}", {
  tag: "reports", summary: "Run one report (finance group: owner only)", operationId: "runReport", source: "src/app/api/reports/[report]/route.ts:17-51",
  roles: OS, query: reportQuery, ok: { 200: ["ReportResponse", R.report] }, errors: [401, 403, 404, 500],
  note: "Slugs: src/lib/reports.ts:68-301. Params read by scopeFrom (src/lib/report-runner.ts:32-47).",
})
op("get", "/api/report-groups/{group}", {
  tag: "reports", summary: "Every chart in a group (sales|inventory|finance|employee)", operationId: "reportGroup", source: "src/app/api/report-groups/[group]/route.ts:27-91",
  roles: OS, query: reportQuery, ok: { 200: ["ReportGroupResponse", R.reportGroup] }, errors: [401, 403, 404, 500],
})

// Site ------------------------------------------------------------------------
op("get", "/api/site", {
  tag: "site", summary: "The workspace website (created on first read)", operationId: "getSite", source: "src/app/api/site/route.ts:27-41",
  roles: OWNER, ok: { 200: ["SiteResponse", R.site] }, errors: [401, 403, 500], sideEffects: ["creates the Site document on first call (lib/site-server.ts:47-76)"],
})
op("put", "/api/site", {
  tag: "site", summary: "Save the whole site", operationId: "saveSite", source: "src/app/api/site/route.ts:62-150",
  roles: OWNER, body: ["SiteRequest", site.siteSchema], ok: { 200: ["SiteSaved", R.siteSaved] },
  errors: [400, 401, 403, 413, 422, 429, 500],
  extraResponses: { 409: { description: "Stale save {code:'stale'} or slug taken", content: { "application/json": { schema: ref("SiteStale", R.siteStale, "output") } } } },
  rateLimit: MUT, sideEffects: ["dropped pictures deleted from S3 (reconcileUploads)"],
})
op("post", "/api/site", {
  tag: "site", summary: "Publish / unpublish", operationId: "publishSite", source: "src/app/api/site/route.ts:160-197",
  roles: OWNER, body: ["PublishRequest", publishSchema], ok: { 200: ["SiteSaved", R.siteSaved] }, errors: [400, 401, 403, 413, 429, 500], rateLimit: MUT,
  sideEffects: ["activity site_published|site_unpublished"],
})

// Super admin -----------------------------------------------------------------
op("get", "/api/admin/overview", {
  tag: "admin", summary: "Whole-system lists", operationId: "adminOverview", source: "src/app/api/admin/overview/route.ts:30-134",
  roles: ["superAdmin"], ok: { 200: ["AdminOverview", R.adminOverview] }, errors: [401, 403, 500],
})
op("patch", "/api/admin/businesses/{id}", {
  tag: "admin", summary: "Block / unblock a workspace", operationId: "adminBlockBusiness", source: "src/app/api/admin/businesses/[id]/route.ts:17-42",
  roles: ["superAdmin"], body: ["BlockRequest", blockSchema], ok: { 200: ["BusinessResponse", R.business] }, errors: [...JSONERR, 404], rateLimit: MUT,
})
op("patch", "/api/admin/users/{id}", {
  tag: "admin", summary: "Block / unblock an account", operationId: "adminBlockUser", source: "src/app/api/admin/users/[id]/route.ts:17-47",
  roles: ["superAdmin"], body: ["BlockRequest", blockSchema], ok: { 200: ["AdminUserResponse", R.adminUser] }, errors: [...JSONERR, 404, 409], rateLimit: MUT,
})
op("post", "/api/admin/invites", {
  tag: "admin", summary: "Issue a workspace sign-up invite", operationId: "adminCreateInvite", source: "src/app/api/admin/invites/route.ts:32-63",
  roles: ["superAdmin"], body: ["WorkspaceInviteRequest", workspaceInviteSchema], ok: { 201: ["WorkspaceInviteCreated", R.workspaceInviteCreated] }, errors: JSONERR, rateLimit: MUT,
  refinements: ["email may not be a super-admin address (admin/invites/route.ts:22)"],
})
op("delete", "/api/admin/invites/{id}", {
  tag: "admin", summary: "Revoke an unused workspace invite", operationId: "adminRevokeInvite", source: "src/app/api/admin/invites/[id]/route.ts:12-37",
  roles: ["superAdmin"], ok: { 200: ["WorkspaceInviteResponse", R.workspaceInvite] }, errors: [401, 403, 404, 409, 429, 500], rateLimit: MUT,
})

// ---- conversion -------------------------------------------------------------

function tolerant(node) {
  if (Array.isArray(node)) return node.forEach(tolerant)
  if (!node || typeof node !== "object") return
  if (node.additionalProperties === false) delete node.additionalProperties
  Object.values(node).forEach(tolerant)
}

for (const io of ["output", "input"]) {
  try {
    const { schemas } = z.toJSONSchema(registries[io], {
      io,
      unrepresentable: "any",
      target: "draft-2020-12",
      uri: (name) => `#/components/schemas/${name}`,
    })
    for (const [name, schema] of Object.entries(schemas)) {
      delete schema.$schema
      delete schema.$id
      // A response may gain fields; a client validating against this must
      // not reject them. (Request objects are z.object, which strips unknown
      // keys rather than refusing them, so input schemas carry no such flag.)
      if (io === "output") tolerant(schema)
      components.schemas[name] = schema
    }
  } catch (error) {
    notes.push({ registry: io, error: error.message })
  }
}

// ---- document ---------------------------------------------------------------

const doc = {
  openapi: "3.1.0",
  info: {
    title: "EMS API (as consumed by the mobile app)",
    version: "discovery-2026-09-27",
    description:
      "Generated by docs/mobile/tools/generate-openapi.mjs from the Zod schemas in src/lib/validations (request bodies) and transcribed DTO types (responses). " +
      "Every non-2xx body is ApiError {error, fieldErrors?} (src/lib/api-response.ts:4-8, 36-74) except the Auth.js credentials refusal {error, url} and the site stale 409. " +
      "Mutations through the proxy require Origin/Referer == host (src/proxy.ts:119-122) — see backend-gaps.md.",
  },
  servers: [{ url: BASE }],
  components: {
    ...components,
    securitySchemes: {
      sessionCookie: {
        type: "apiKey", in: "cookie", name: "__Secure-authjs.session-token",
        description: "Auth.js v5 JWT session cookie (strategy jwt, src/auth.config.ts:14-16). Re-validated against the DB on every request (src/lib/auth/guards.ts:24-68).",
      },
      bearerToken: {
        type: "http", scheme: "bearer",
        description: "PROPOSED, not implemented — see docs/mobile/backend-gaps.md §1.",
      },
    },
  },
  paths,
}

const operationsCount = Object.values(paths).reduce((sum, item) => sum + Object.keys(item).length, 0)
doc.info["x-counts"] = { paths: Object.keys(paths).length, operations: operationsCount, schemas: Object.keys(components.schemas).length }
if (notes.length) doc.info["x-conversion-notes"] = notes

writeFileSync(new URL("../openapi.json", import.meta.url), `${JSON.stringify(doc, null, 2)}\n`)
console.log(`openapi.json: ${Object.keys(paths).length} paths, ${operationsCount} operations, ${Object.keys(components.schemas).length} schemas, ${notes.length} conversion notes`)
for (const note of notes) console.log("  note:", note.registry, "-", note.error)
