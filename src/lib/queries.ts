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
import type { NotificationDTO } from "@/models/notification"
import type { ProjectDTO } from "@/models/project"
import type { RequestDTO } from "@/models/request"
import type { ProjectStatus, RequestStatus } from "@/lib/work-constants"
import type { TaskDTO } from "@/models/task"
import type { UserDTO } from "@/models/user"

export type TaskScope = "today" | "in_progress" | "upcoming" | "done" | "all"

/** One place for every key, so invalidation can't drift from the fetches. */
export const keys = {
  tasks: (scope: TaskScope) => ["tasks", scope] as const,
  task: (id: string) => ["task", id] as const,
  attendance: (month?: string, userId?: string) =>
    ["attendance", month ?? "current", userId ?? "me"] as const,
  requests: (status?: RequestStatus) => ["requests", status ?? "all"] as const,
  people: (includeRemoved?: boolean) =>
    ["people", includeRemoved ? "all" : "active"] as const,
  projects: (status?: string) => ["projects", status ?? "all"] as const,
  notifications: (unread?: boolean) =>
    ["notifications", unread ? "unread" : "all"] as const,
  unreadCount: () => ["notifications", "count"] as const,
}

type TasksResponse = { tasks: TaskDTO[] }
type TaskResponse = { task: TaskDTO; history: CheckInDTO[] }
type AttendanceResponse = {
  month: string
  today: string
  timeZone: string
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

export function useTasks(scope: TaskScope) {
  return useQuery({
    queryKey: keys.tasks(scope),
    queryFn: () =>
      apiFetch<TasksResponse>(`/api/tasks${buildQueryString({ scope })}`),
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

export function useShiftAction() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (action: "start" | "end") =>
      apiFetch<{ attendance: AttendanceDTO }>("/api/attendance", {
        method: "POST",
        body: JSON.stringify({ action }),
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
