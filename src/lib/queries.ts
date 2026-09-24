"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiRequestError, apiFetch, buildQueryString } from "@/lib/api-client"
import type { Fix } from "@/lib/geolocation"
import type { AttendanceDTO } from "@/models/attendance"
import type { CheckInDTO } from "@/models/check-in"
import type { CategoryDTO } from "@/models/inventory-category"
import type { AdminBusiness, AdminProject, AdminUser } from "@/lib/admin"
import type { WorkspaceInviteDTO } from "@/models/workspace-invite"
import type { BillDTO } from "@/models/bill"
import type { CustomerDTO } from "@/models/customer"
import type { ItemDTO } from "@/models/inventory-item"
import type { ExpenseDTO } from "@/models/expense"
import type { SiteDTO } from "@/models/site"
import type { PaymentDTO } from "@/models/payment"
import type { ActivityDTO } from "@/models/activity"
import type { ReportColumn, ReportChartData } from "@/lib/reports"
import type { WeekPattern } from "@/lib/week"
import type { OperationDTO } from "@/models/operation"
import type { ScheduleDTO } from "@/models/schedule"
import type { NotificationDTO } from "@/models/notification"
import type { ProjectDTO } from "@/models/project"
import type { RequestDTO } from "@/models/request"
import type {
  BillPayment,
  ProjectStatus,
  RequestStatus,
} from "@/lib/work-constants"
import type { TaskDTO } from "@/models/task"
import type { UserDTO } from "@/models/user"

export type TaskScope =
  | "today"
  | "in_progress"
  | "in_review"
  | "upcoming"
  | "done"
  | "all"

/** One place for every key, so invalidation can't drift from the fetches. */
export const keys = {
  tasks: (scope: TaskScope, projectId?: string) =>
    ["tasks", scope, projectId ?? "all"] as const,
  task: (id: string) => ["task", id] as const,
  attendance: (month?: string, userId?: string) =>
    ["attendance", month ?? "current", userId ?? "me"] as const,
  crewAttendance: (day?: string) => ["attendance", "crew", day ?? "today"] as const,
  visits: (day?: string) => ["attendance", "visits", day ?? "today"] as const,
  activity: (day?: string) => ["activity", day ?? "today"] as const,
  operations: (kind?: string) => ["operations", kind ?? "all"] as const,
  schedules: (from?: string) => ["schedules", from ?? "this-week"] as const,
  calendar: (month?: string) => ["calendar", month ?? "this-month"] as const,
  report: (slug: string, filters: string) => ["report", slug, filters] as const,
  requests: (status?: RequestStatus) => ["requests", status ?? "all"] as const,
  people: (includeRemoved?: boolean) =>
    ["people", includeRemoved ? "all" : "active"] as const,
  projects: (status?: string) => ["projects", status ?? "all"] as const,
  notifications: (unread?: boolean) =>
    ["notifications", unread ? "unread" : "all"] as const,
  unreadCount: () => ["notifications", "count"] as const,
  inventoryItems: () => ["inventory", "items"] as const,
  inventoryCategories: () => ["inventory", "categories"] as const,
  bills: () => ["bills"] as const,
  payments: () => ["payments"] as const,
  expenses: () => ["expenses"] as const,
  site: () => ["site"] as const,
  customers: () => ["customers"] as const,
  adminOverview: () => ["admin", "overview"] as const,
}

type TasksResponse = { tasks: TaskDTO[] }
type TaskResponse = { task: TaskDTO; history: CheckInDTO[] }
type AttendanceResponse = {
  month: string
  today: string
  timeZone: string
  week: WeekPattern | null
  days: AttendanceDTO[]
  summary: { present: number; late: number; leave: number; absent: number }
}
type RequestsResponse = {
  requests: RequestDTO[]
  counts: { pending: number; approved: number; rejected: number }
}
type CheckInResponse = {
  task: TaskDTO
  checkIn: CheckInDTO
  attendance: AttendanceDTO
}

export function useTasks(scope: TaskScope, projectId?: string) {
  return useQuery({
    queryKey: keys.tasks(scope, projectId),
    queryFn: () =>
      apiFetch<TasksResponse>(
        `/api/tasks${buildQueryString({ scope, projectId })}`
      ),
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: keys.task(id),
    queryFn: () => apiFetch<TaskResponse>(`/api/tasks/${id}`),
  })
}

export function useAttendance(month?: string, userId?: string) {
  return useQuery({
    queryKey: keys.attendance(month, userId),
    queryFn: () =>
      apiFetch<AttendanceResponse>(
        `/api/attendance${buildQueryString({ month, userId })}`
      ),
  })
}

export function useRequests(status?: RequestStatus) {
  return useQuery({
    queryKey: keys.requests(status),
    queryFn: () =>
      apiFetch<RequestsResponse>(
        `/api/requests${buildQueryString({ status })}`
      ),
  })
}

export function usePeople(includeRemoved = false) {
  return useQuery({
    queryKey: keys.people(includeRemoved),
    queryFn: () =>
      apiFetch<{ members: UserDTO[] }>(
        `/api/people${includeRemoved ? "?includeRemoved=1" : ""}`
      ),
  })
}

/**
 * Check in / out. `mutate` is a no-op while one is already in flight, which is
 * the client half of the double-submit guard — the server holds the other half
 * by rejecting a second check-in with 409.
 */
export function useCheckIn(taskId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: Fix & { reason?: string }) =>
      apiFetch<CheckInResponse>(`/api/tasks/${taskId}/check-in`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateWork(client),
  })
}

export function useCheckOut(taskId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: Fix & { reason?: string }) =>
      apiFetch<CheckInResponse>(`/api/tasks/${taskId}/check-out`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateWork(client),
  })
}

export function useTaskStatus(taskId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: { status: string; blockedReason?: string }) =>
      apiFetch<{ task: TaskDTO }>(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateWork(client),
  })
}

/**
 * Start / end shift. A start carries the position and, when the workspace has
 * an office and the person is outside its outer ring, the reason why.
 */
export function useShiftAction() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: {
      action: "start" | "end"
      lat?: number
      lng?: number
      accuracyM?: number
      reason?: string
      note?: string
    }) =>
      apiFetch<{ attendance: AttendanceDTO }>("/api/attendance", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["attendance"] })
    },
  })
}

export function useCreateRequest() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ request: RequestDTO }>("/api/requests", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["requests"] })
    },
  })
}

export function useDecideRequest(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: { status: "approved" | "rejected"; decisionNote?: string }) =>
      apiFetch<{ request: RequestDTO }>(`/api/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["requests"] })
      void client.invalidateQueries({ queryKey: ["attendance"] })
    },
  })
}

export function useCreateTask() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ task: TaskDTO }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

/** A check-in moves a task, the day's attendance, and every task list. */
function invalidateWork(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["tasks"] })
  void client.invalidateQueries({ queryKey: ["task"] })
  void client.invalidateQueries({ queryKey: ["attendance"] })
}

/** Turns an API failure into a toast, and hands field errors back to a form. */
export function reportMutationError(
  error: unknown,
  setFieldError?: (path: string, message: string) => void
) {
  if (error instanceof ApiRequestError) {
    if (setFieldError) {
      for (const [path, messages] of Object.entries(error.fieldErrors ?? {})) {
        setFieldError(path, messages[0])
      }
    }
    toast.error(error.message)
    return
  }

  toast.error(
    error instanceof Error ? error.message : "Could not reach the server"
  )
}

export type ProjectWithCounts = ProjectDTO & {
  tasks: { total: number; open: number; blocked: number; done: number }
}

export function useProjects(status?: ProjectStatus) {
  return useQuery({
    queryKey: keys.projects(status),
    queryFn: () =>
      apiFetch<{ projects: ProjectWithCounts[] }>(
        `/api/projects${buildQueryString({ status })}`
      ),
  })
}

export function useCreateProject() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ project: ProjectDTO }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export function useSetProjectStatus(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (status: ProjectStatus) =>
      apiFetch<{ project: ProjectDTO }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["projects"] })
      void client.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: keys.notifications(unreadOnly),
    queryFn: () =>
      apiFetch<{ notifications: NotificationDTO[]; unread: number }>(
        `/api/notifications${unreadOnly ? "?unread=1" : ""}`
      ),
    // The unread badge should not go stale while someone reads the page.
    refetchInterval: 60_000,
  })
}

export function useMarkRead() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id?: string) =>
      apiFetch<{ marked: number; unread: number }>("/api/notifications", {
        method: "POST",
        body: JSON.stringify(id ? { id } : {}),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

/**
 * Just the badge number. Shares the "notifications" key prefix, so marking
 * anything read invalidates it along with the feed itself.
 */
export function useUnreadCount(initial: number) {
  return useQuery({
    queryKey: keys.unreadCount(),
    queryFn: () =>
      apiFetch<{ unread: number }>("/api/notifications?count=1"),
    initialData: { unread: initial },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useUpdateTask(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ task: TaskDTO }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateWork(client),
  })
}

export function useUpdateProject(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ project: ProjectDTO }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["projects"] })
      void client.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useUpdateMember(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ member: UserDTO }>(`/api/people/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidatePeople(client),
  })
}

/** Removal cancels their unstarted tasks, so task lists move too. */
export function useRemoveMember(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ member: UserDTO; cancelledTasks: number }>(
        `/api/people/${id}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidatePeople(client)
      void client.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

function invalidatePeople(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["people"] })
}

/**
 * Board moves: the id comes with the call rather than the hook, so one
 * mutation serves every card instead of one hook per task.
 */
export function useMoveTask() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<{ task: TaskDTO }>(`/api/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => invalidateWork(client),
  })
}

/* ---------------------------------------------------------------- inventory */

export type CategoryWithCount = CategoryDTO & { items: number }

/** `enabled: false` keeps a custom bill from fetching stock it never uses. */
export function useInventoryItems(enabled = true) {
  return useQuery({
    queryKey: keys.inventoryItems(),
    queryFn: () => apiFetch<{ items: ItemDTO[] }>("/api/inventory/items"),
    enabled,
  })
}

export function useInventoryCategories() {
  return useQuery({
    queryKey: keys.inventoryCategories(),
    queryFn: () =>
      apiFetch<{ categories: CategoryWithCount[] }>(
        "/api/inventory/categories"
      ),
  })
}

export function useCreateItem() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ item: ItemDTO }>("/api/inventory/items", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateInventory(client),
  })
}

export function useUpdateItem(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ item: ItemDTO }>(`/api/inventory/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateInventory(client),
  })
}

export function useDeleteItem(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/inventory/items/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateInventory(client),
  })
}

export function useCreateCategory() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ category: CategoryDTO }>("/api/inventory/categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateInventory(client),
  })
}

export function useUpdateCategory(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ category: CategoryDTO }>(`/api/inventory/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateInventory(client),
  })
}

export function useDeleteCategory(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/inventory/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateInventory(client),
  })
}

/**
 * Items and categories share the "inventory" prefix: renaming a category
 * changes what the item rows read, and adding an item changes the counts the
 * categories tab shows, so both lists move together.
 */
function invalidateInventory(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["inventory"] })
}

/* -------------------------------------------------------------------- bills */

export function useBills() {
  return useQuery({
    queryKey: keys.bills(),
    queryFn: () => apiFetch<{ bills: BillDTO[] }>("/api/bills"),
  })
}

export function useCreateBill() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ bill: BillDTO }>("/api/bills", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateSales(client),
  })
}

export function useVoidBill(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ bill: BillDTO }>(`/api/bills/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "void" }),
      }),
    onSuccess: () => invalidateSales(client),
  })
}

/** A sale moves stock, so the inventory lists are no longer current either. */
function invalidateSales(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["bills"] })
  void client.invalidateQueries({ queryKey: ["inventory"] })
}

/** Marking a bill paid, unpaid or on cheque after it was raised. */
export function useSetBillPayment(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: { payment: BillPayment; chequeNo?: string }) =>
      apiFetch<{ bill: BillDTO }>(`/api/bills/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["bills"] })
    },
  })
}

/* ----------------------------------------------------------------- payments */

export function usePayments() {
  return useQuery({
    queryKey: keys.payments(),
    queryFn: () => apiFetch<{ payments: PaymentDTO[] }>("/api/payments"),
  })
}

export function useCreatePayment() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ payment: PaymentDTO }>("/api/payments", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateMoney(client),
  })
}

export function useDeletePayment(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateMoney(client),
  })
}

/** A payment can settle a bill, so the bills list moves with the ledger. */
function invalidateMoney(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["payments"] })
  void client.invalidateQueries({ queryKey: ["bills"] })
}

/* ----------------------------------------------------------------- expenses */

export function useExpenses() {
  return useQuery({
    queryKey: keys.expenses(),
    queryFn: () => apiFetch<{ expenses: ExpenseDTO[] }>("/api/expenses"),
  })
}

export function useCreateExpense() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ expense: ExpenseDTO }>("/api/expenses", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateSpend(client),
  })
}

export function useUpdateExpense(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ expense: ExpenseDTO }>(`/api/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateSpend(client),
  })
}

export function useDeleteExpense(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateSpend(client),
  })
}

/**
 * A stock purchase raises the shelf and mirrors itself onto the cash ledger,
 * so recording one moves the inventory and the payments lists as well as its
 * own.
 */
function invalidateSpend(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["expenses"] })
  void client.invalidateQueries({ queryKey: ["payments"] })
  void client.invalidateQueries({ queryKey: ["inventory"] })
}

/* --------------------------------------------------------------------- site */

export function useSite() {
  return useQuery({
    queryKey: keys.site(),
    queryFn: () =>
      apiFetch<{ site: SiteDTO; uploads: boolean }>("/api/site"),
  })
}

export function useSaveSite() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ site: SiteDTO }>("/api/site", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.site() })
    },
  })
}

/** Publishing is one flag — the subdomain serves it the moment it is set. */
export function usePublishSite() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (published: boolean) =>
      apiFetch<{ site: SiteDTO }>("/api/site", {
        method: "POST",
        body: JSON.stringify({ published }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.site() })
    },
  })
}

/* -------------------------------------------------------------- super admin */

export type AdminOverview = {
  businesses: AdminBusiness[]
  users: AdminUser[]
  projects: AdminProject[]
  invites: WorkspaceInviteDTO[]
}

export function useAdminOverview() {
  return useQuery({
    queryKey: keys.adminOverview(),
    queryFn: () => apiFetch<AdminOverview>("/api/admin/overview"),
  })
}

/** Blocking either kind reshapes the whole list, so it all refetches. */
export function useBlockUser(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (blocked: boolean) =>
      apiFetch<{ user: UserDTO }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ blocked }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin"] })
    },
  })
}

export function useBlockBusiness(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (blocked: boolean) =>
      apiFetch<{ business: unknown }>(`/api/admin/businesses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ blocked }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin"] })
    },
  })
}

/**
 * Issues a workspace invite. The link comes back once, in the response —
 * only its hash is stored, so it can't be recovered from the list later.
 */
export function useCreateWorkspaceInvite() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ invite: WorkspaceInviteDTO; signupUrl: string }>(
        "/api/admin/invites",
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin"] })
    },
  })
}

export function useRevokeWorkspaceInvite(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ invite: WorkspaceInviteDTO }>(`/api/admin/invites/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin"] })
    },
  })
}

/* ---------------------------------------------------------------- customers */

export function useCustomers(enabled = true) {
  return useQuery({
    queryKey: keys.customers(),
    queryFn: () => apiFetch<{ customers: CustomerDTO[] }>("/api/customers"),
    enabled,
  })
}

export function useCreateCustomer() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ customer: CustomerDTO }>("/api/customers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateCustomers(client),
  })
}

export function useUpdateCustomer(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ customer: CustomerDTO }>(`/api/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateCustomers(client),
  })
}

export function useDeleteCustomer(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateCustomers(client),
  })
}

function invalidateCustomers(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["customers"] })
}

export type CrewAttendanceRow = {
  user: {
    id: string
    name: string
    role: string
    shift: string | null
    removed: boolean
    /** Their repeating week makes this day a rest day. */
    resting: boolean
    week: WeekPattern | null
  }
  attendance: AttendanceDTO | null
}

type CrewAttendanceResponse = {
  day: string
  today: string
  timeZone: string
  rows: CrewAttendanceRow[]
  summary: {
    crew: number
    present: number
    resting: number
    absent: number
    late: number
    leave: number
    away: number
    stillIn: number
  }
}

export type Visit = {
  id: string
  type: "in" | "out"
  at: string
  user: { id: string; name: string }
  task: { id: string; title: string; site: string }
  lat: number
  lng: number
  accuracyM: number | null
  distanceM: number
  insideFence: boolean
  reason: string | null
}

type VisitsResponse = {
  day: string
  today: string
  timeZone: string
  visits: Visit[]
  summary: {
    total: number
    arrivals: number
    departures: number
    outside: number
    people: number
  }
}

type ActivityResponse = {
  day: string
  today: string
  timeZone: string
  entries: ActivityDTO[]
  summary: { total: number; people: number }
}

/** The whole crew's day. Owners and supervisors only — the API enforces it. */
export function useCrewAttendance(day?: string) {
  return useQuery({
    queryKey: keys.crewAttendance(day),
    queryFn: () =>
      apiFetch<CrewAttendanceResponse>(
        `/api/attendance/crew${buildQueryString({ day })}`
      ),
  })
}

/** Arrivals at and departures from tasks, for the same day. */
export function useVisits(day?: string) {
  return useQuery({
    queryKey: keys.visits(day),
    queryFn: () =>
      apiFetch<VisitsResponse>(
        `/api/attendance/visits${buildQueryString({ day })}`
      ),
  })
}

/** The audit trail for one day. Owner only. */
export function useActivity(day?: string) {
  return useQuery({
    queryKey: keys.activity(day),
    queryFn: () =>
      apiFetch<ActivityResponse>(`/api/activity${buildQueryString({ day })}`),
  })
}

// ---- operations ----------------------------------------------------------

type OperationsResponse = { operations: OperationDTO[] }

export type CalendarItem = {
  id: string
  source: "operation" | "task"
  kind: string
  title: string
  day: string
  startAt: string
  endAt: string | null
  allDay: boolean
  status: string
  priority: string
  people: string[]
  where: string | null
}

type CalendarResponse = {
  month: string
  today: string
  timeZone: string
  items: CalendarItem[]
  summary: { total: number; operations: number; tasks: number }
}

export type CrewMember = {
  id: string
  name: string
  role: string
  shift: string | null
  /** The week behind the grid, for cells with no row of their own. */
  week: WeekPattern | null
}

type SchedulesResponse = {
  from: string
  days: string[]
  today: string
  timeZone: string
  crew: CrewMember[]
  entries: ScheduleDTO[]
}

/** One kind of operation, or every kind when `kind` is left out. */
export function useOperations(kind?: string) {
  return useQuery({
    queryKey: keys.operations(kind),
    queryFn: () =>
      apiFetch<OperationsResponse>(
        `/api/operations${buildQueryString({ kind })}`
      ),
  })
}

export function useCreateOperation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ operation: OperationDTO }>("/api/operations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => refreshOperations(client),
  })
}

export function useUpdateOperation(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ operation: OperationDTO }>(`/api/operations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => refreshOperations(client),
  })
}

export function useDeleteOperation(id: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/operations/${id}`, { method: "DELETE" }),
    onSuccess: () => refreshOperations(client),
  })
}

/** One month of everything dated — operations and the tasks beside them. */
export function useCalendar(month?: string) {
  return useQuery({
    queryKey: keys.calendar(month),
    queryFn: () =>
      apiFetch<CalendarResponse>(`/api/calendar${buildQueryString({ month })}`),
  })
}

export function useSchedules(from?: string) {
  return useQuery({
    queryKey: keys.schedules(from),
    queryFn: () =>
      apiFetch<SchedulesResponse>(`/api/schedules${buildQueryString({ from })}`),
  })
}

export function useSetSchedule() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ entry: ScheduleDTO }>("/api/schedules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["schedules"] })
      void client.invalidateQueries({ queryKey: ["activity"] })
    },
  })
}

export function useClearSchedule() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["schedules"] })
      void client.invalidateQueries({ queryKey: ["activity"] })
    },
  })
}

/** Every operation write moves the calendar and the log as well as the list. */
function refreshOperations(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["operations"] })
  void client.invalidateQueries({ queryKey: ["calendar"] })
  void client.invalidateQueries({ queryKey: ["activity"] })
}

// ---- reports -------------------------------------------------------------

export type ReportFilters = {
  from?: string
  to?: string
  employeeId?: string
  customerId?: string
  categoryId?: string
  payment?: string
}

type ReportResponse = {
  slug: string
  blocked: boolean
  missing?: string
  unlock?: string[]
  columns?: ReportColumn[]
  rows?: Record<string, string | number | null>[]
  totals?: { label: string; value: string }[]
  stats?: { label: string; value: string; accent?: boolean }[]
  chart?: ReportChartData
  note?: string
}

/**
 * One report, run server-side. `enabled` is false for a report with nothing
 * behind it, so a blocked page never makes a request it knows will be empty.
 */
export function useReport(
  slug: string,
  filters: ReportFilters,
  enabled = true
) {
  const query = buildQueryString(filters)

  return useQuery({
    enabled,
    queryKey: keys.report(slug, query),
    queryFn: () => apiFetch<ReportResponse>(`/api/reports/${slug}${query}`),
  })
}

export type GroupReportCard = {
  slug: string
  title: string
  subtitle: string
  status: "ready" | "partial" | "blocked"
  missing?: string
  chart: ReportChartData | null
  stats: { label: string; value: string; accent?: boolean }[]
  rows: number
}

type ReportGroupResponse = { group: string; reports: GroupReportCard[] }

/**
 * A whole category's reports in one request — what the hub pages draw. Asking
 * per report would be eight round trips and eight chances for the cards to
 * disagree about the window they cover.
 */
export function useReportGroup(group: string, filters: ReportFilters) {
  const query = buildQueryString(filters)

  return useQuery({
    queryKey: ["report-group", group, query],
    queryFn: () =>
      apiFetch<ReportGroupResponse>(`/api/report-groups/${group}${query}`),
  })
}
