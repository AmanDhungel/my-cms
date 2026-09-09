"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { MapPicker, type Pin } from "@/components/dashboard/map-picker"
import { ProjectDialog } from "@/components/dashboard/projects/project-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  reportMutationError,
  useCreateTask,
  usePeople,
  useProjects,
  useUpdateTask,
} from "@/lib/queries"
import { taskSchema } from "@/lib/validations/work"
import { DEFAULT_RADIUS_M, TASK_PRIORITIES } from "@/lib/work-constants"
import type { TaskDTO } from "@/models/task"

type Errors = Partial<Record<string, string>>

/** Pass `task` to edit it; leave it out to assign a new one. */
export function TaskDialog({
  open,
  onClose,
  task,
}: {
  open: boolean
  onClose: () => void
  task?: TaskDTO
}) {
  const editing = Boolean(task)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "sm:max-w-[640px] p-5 sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            {editing ? "Edit task" : "New task"}
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            Pin where the work is; the assignee checks in from inside that area.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each visit starts from the task as it
            stands rather than from whatever was typed last time. */}
        {open ? <Body onClose={onClose} task={task} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ onClose, task }: { onClose: () => void; task?: TaskDTO }) {
  const [form, setForm] = React.useState(() => blank(task))
  const [pin, setPin] = React.useState<Pin | null>(
    task ? { lat: task.lat, lng: task.lng } : null
  )
  const [errors, setErrors] = React.useState<Errors>({})
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false)

  const people = usePeople()
  const projects = useProjects("active")
  const create = useCreateTask()
  const update = useUpdateTask(task?.id ?? "")
  const mutation = task ? update : create

  const assignable = (people.data?.members ?? []).filter(
    (member) => member.role !== "owner"
  )
  const projectList = projects.data?.projects ?? []
  const noProjects = !projects.isPending && projectList.length === 0

  function set<K extends keyof ReturnType<typeof blank>>(
    key: K,
    value: ReturnType<typeof blank>[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  /** Picking a project fills the site in, unless one has been typed already. */
  function chooseProject(id: string) {
    set("projectId", id)
    const project = projectList.find((entry) => entry.id === id)
    if (project?.site && !form.site) set("site", project.site)
  }

  const handlePin = React.useCallback((next: Pin) => {
    setPin(next)
    setErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }))
  }, [])

  const radiusM = Number(form.radiusM) || DEFAULT_RADIUS_M

  function submit() {
    if (mutation.isPending) return

    if (!pin) {
      setErrors((prev) => ({ ...prev, lat: "Drop a marker on the map" }))
      return
    }

    const parsed = taskSchema.safeParse({
      ...form,
      lat: pin.lat,
      lng: pin.lng,
      startAt: toIso(form.startAt),
      endAt: toIso(form.endAt),
    })

    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(task ? "Task updated" : "Task assigned")
        onClose()
      },
      onError: (error) =>
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({ ...prev, [path]: message }))
        ),
    })
  }

  return (
    <>
      <div className="flex max-h-[62vh] flex-col gap-3.5 overflow-auto pr-0.5">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Task title</FieldLabel>
          <input
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Warehouse restock — Bay 3"
            aria-invalid={Boolean(errors.title)}
            className={inputClass}
          />
          <FieldError message={errors.title} />
        </label>

        <div className="flex flex-col gap-[7px]">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>Project</FieldLabel>
            <button
              type="button"
              onClick={() => setProjectDialogOpen(true)}
              className="text-p-600 text-[12.5px] font-semibold"
            >
              + New project
            </button>
          </div>

          {projects.isPending ? (
            <Skeleton className="h-11 w-full rounded-md" />
          ) : noProjects ? (
            <div className="border-a-400 bg-a-50 flex flex-col items-start gap-2.5 rounded-md border p-3.5">
              <p className="text-a-900 m-0 text-[13px] leading-relaxed">
                There are no projects yet, and every task belongs to one. Create
                the first one and it will be selected here.
              </p>
              <button
                type="button"
                onClick={() => setProjectDialogOpen(true)}
                className="bg-a-400 text-a-900 rounded-md px-3 py-2 text-[13px] font-semibold hover:brightness-[1.06]"
              >
                Add a project
              </button>
            </div>
          ) : (
            <select
              value={form.projectId}
              onChange={(event) => chooseProject(event.target.value)}
              aria-invalid={Boolean(errors.projectId)}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">Pick a project</option>
              {projectList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          <FieldError message={errors.projectId} />
        </div>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Anything they need before arriving"
            className={cn(inputClass, "min-h-[72px] resize-y")}
          />
          <FieldError message={errors.description} />
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Assign to</FieldLabel>
            <select
              value={form.assigneeId}
              onChange={(event) => set("assigneeId", event.target.value)}
              aria-invalid={Boolean(errors.assigneeId)}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">
                {people.isPending ? "Loading people…" : "Pick someone"}
              </option>
              {assignable.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
            {!people.isPending && assignable.length === 0 ? (
              <span className="text-a-700 text-[12px]">
                Nobody to assign yet — invite someone from People first.
              </span>
            ) : null}
            <FieldError message={errors.assigneeId} />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Priority</FieldLabel>
            <select
              value={form.priority}
              onChange={(event) =>
                set("priority", event.target.value as typeof form.priority)
              }
              className={cn(inputClass, "cursor-pointer capitalize")}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Starts</FieldLabel>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => set("startAt", event.target.value)}
              aria-invalid={Boolean(errors.startAt)}
              className={inputClass}
            />
            <FieldError message={errors.startAt} />
          </label>
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Ends</FieldLabel>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => set("endAt", event.target.value)}
              aria-invalid={Boolean(errors.endAt)}
              className={inputClass}
            />
            <FieldError message={errors.endAt} />
          </label>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-[1fr_140px]">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Site</FieldLabel>
            <input
              value={form.site}
              onChange={(event) => set("site", event.target.value)}
              placeholder="Balaju Industrial Area"
              aria-invalid={Boolean(errors.site)}
              className={inputClass}
            />
            <FieldError message={errors.site} />
          </label>
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Radius (m)</FieldLabel>
            <input
              inputMode="numeric"
              value={form.radiusM}
              onChange={(event) => set("radiusM", event.target.value)}
              aria-invalid={Boolean(errors.radiusM)}
              className={cn(inputClass, "font-mono")}
            />
            <FieldError message={errors.radiusM} />
          </label>
        </div>

        <div className="flex flex-col gap-[7px]">
          <FieldLabel>Where is it?</FieldLabel>
          <MapPicker value={pin} radiusM={radiusM} onChange={handlePin} />
          <FieldError message={errors.lat ?? errors.lng} />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={mutation.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {mutation.isPending
            ? task
              ? "Saving…"
              : "Assigning…"
            : task
              ? "Save changes"
              : "Assign task"}
        </button>
      </DialogFooter>

      {/* Nested, so making a project mid-form doesn't lose what's typed. */}
      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        onCreated={(project) => {
          // Functional, so it reads whatever is in the form right now rather
          // than what it held when this callback was created.
          setForm((prev) => ({
            ...prev,
            projectId: project.id,
            site: prev.site || project.site || "",
          }))
          setErrors((prev) => ({
            ...prev,
            projectId: undefined,
            site: undefined,
          }))
        }}
      />
    </>
  )
}

function blank(task?: TaskDTO) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.project?.id ?? "",
    site: task?.site ?? "",
    radiusM: String(task?.radiusM ?? DEFAULT_RADIUS_M),
    startAt: toLocal(task?.startAt),
    endAt: toLocal(task?.endAt),
    assigneeId: task?.assignee?.id ?? "",
    priority: (task?.priority ?? "normal") as (typeof TASK_PRIORITIES)[number],
  }
}

/** The inverse of `toIso`: an instant back into the input's wall clock. */
function toLocal(iso?: string) {
  if (!iso) return ""
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** `datetime-local` gives a wall-clock string; the API takes an instant. */
function toIso(local: string) {
  if (!local) return ""
  const parsed = new Date(local)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString()
}
