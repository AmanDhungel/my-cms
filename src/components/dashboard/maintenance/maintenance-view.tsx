"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { ImagePickerList } from "@/components/dashboard/image-picker"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
} from "@/components/dashboard/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { money } from "@/lib/billing"
import {
  reportMutationError,
  useCreateMaintenance,
  useCustomers,
  useDeleteMaintenance,
  useMaintenance,
  usePeople,
  useUpdateMaintenance,
} from "@/lib/queries"
import {
  commitImages,
  emptyImage,
  type ImageDraft,
} from "@/lib/upload-client"
import { maintenanceSchema } from "@/lib/validations/maintenance"
import {
  MAINTENANCE_STATUSES,
  type MaintenanceStatus,
} from "@/lib/work-constants"
import type { MaintenanceDTO } from "@/models/maintenance"

const PER_PAGE = 10

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  awaiting_parts: "Awaiting parts",
  repairing: "On the bench",
  repaired: "Repaired",
  returned: "Returned",
  scrapped: "Scrapped",
}

/** Which ones still need somebody to do something. */
const OPEN: MaintenanceStatus[] = [
  "received",
  "diagnosing",
  "awaiting_parts",
  "repairing",
  "repaired",
]

/**
 * The repair bench.
 *
 * What came in, whose it is, what is wrong with it and where it has got to.
 * The serial number is given its own column because it is the only thing
 * telling two identical pumps apart, and handing back the wrong one is the
 * mistake this page exists to prevent.
 */
export function MaintenanceView({ today }: { today: string }) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MaintenanceDTO | null>(null)
  const [filter, setFilter] = React.useState<MaintenanceStatus | "open" | "all">(
    "open"
  )
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)

  const query = useMaintenance()
  const items = query.data?.items ?? []
  const uploads = query.data?.uploads ?? false

  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  const needle = search.trim().toLowerCase()
  const visible = items.filter((row) => {
    if (filter === "open" && !OPEN.includes(row.status)) return false
    if (filter !== "open" && filter !== "all" && row.status !== filter) {
      return false
    }
    if (!needle) return true
    return [row.item, row.makeModel, row.serialNumber, row.owner, row.fault].some(
      (field) => field?.toLowerCase().includes(needle)
    )
  })

  const shown = paginate(visible, page, PER_PAGE)

  const onBench = items.filter((row) => OPEN.includes(row.status)).length
  const waiting = items.filter((row) => row.status === "awaiting_parts").length
  const ready = items.filter((row) => row.status === "repaired").length
  const overdue = items.filter(
    (row) => row.dueAt && row.dueAt < today && OPEN.includes(row.status)
  ).length

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Operations"
        title="Maintenance"
        subtitle="Items in for repair: what came in, what is wrong with it, and where it has got to."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
            className={primaryButtonClass}
          >
            <PlusIcon className="size-3.5" />
            Take one in
          </button>
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="ON THE BENCH" value={onBench} />
          <StatCard
            label="AWAITING PARTS"
            value={waiting}
            accent={waiting > 0}
            hint={waiting > 0 ? "somebody has to chase these" : undefined}
          />
          <StatCard
            label="READY TO GO BACK"
            value={ready}
            hint={ready > 0 ? "repaired, not yet returned" : undefined}
          />
          <StatCard label="PAST DUE" value={overdue} accent={overdue > 0} />
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the bench. Your connection may have dropped."
          action={
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          message="Nothing in for repair. When something comes in, record what it is, its serial number and what is wrong with it — and photograph it, which is the only defence against an argument about a scratch later."
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              Take one in
            </button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="On the bench"
                active={filter === "open"}
                onClick={() => change(setFilter)("open")}
              />
              <Chip
                label="All"
                active={filter === "all"}
                onClick={() => change(setFilter)("all")}
              />
              {MAINTENANCE_STATUSES.map((status) => {
                const n = items.filter((row) => row.status === status).length
                if (n === 0) return null
                return (
                  <Chip
                    key={status}
                    label={STATUS_LABELS[status]}
                    count={n}
                    active={filter === status}
                    onClick={() => change(setFilter)(status)}
                  />
                )
              })}
            </div>

            <label className="border-n-200 bg-n-50 flex min-w-[210px] items-center gap-2 rounded-md border px-2.5 py-2">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => change(setSearch)(event.target.value)}
                placeholder="Item, serial, owner"
                aria-label="Search the bench"
                className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
              />
            </label>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[64px_1.4fr_140px_1fr_130px_92px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["", "ITEM", "SERIAL", "FAULT", "STATE", ""].map((head, i) => (
              <span
                key={`${head}-${i}`}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {shown.rows.map((row) => (
            <div
              key={row.id}
              data-maintenance-row
              className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[64px_1.4fr_140px_1fr_130px_92px] lg:items-center"
            >
              <div className="bg-n-100 border-n-200 size-[52px] shrink-0 overflow-hidden rounded-md border">
                {row.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.photos[0]}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-n-400 flex size-full items-center justify-center font-mono text-[8px] tracking-[0.06em]">
                    NO PIC
                  </span>
                )}
              </div>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {row.item}
                </span>
                <span className="text-n-500 truncate text-xs">
                  {[row.makeModel, row.owner].filter(Boolean).join(" · ") ||
                    "—"}
                </span>
              </span>

              <span className="text-n-700 truncate font-mono text-[12.5px]">
                {row.serialNumber ?? "—"}
              </span>

              <span className="text-n-600 line-clamp-2 text-[12.5px] leading-snug">
                {row.fault}
              </span>

              <span className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                    row.status === "awaiting_parts"
                      ? "bg-a-400/15 text-a-700"
                      : row.status === "repaired"
                        ? "bg-s-done/15 text-s-done"
                        : row.status === "returned" || row.status === "scrapped"
                          ? "bg-n-100 text-n-500"
                          : "bg-p-100 text-p-700"
                  )}
                >
                  {STATUS_LABELS[row.status]}
                </span>
                {row.dueAt ? (
                  <span
                    className={cn(
                      "text-[11.5px]",
                      row.dueAt < today && OPEN.includes(row.status)
                        ? "text-s-overdue font-semibold"
                        : "text-n-500"
                    )}
                  >
                    due {row.dueAt}
                  </span>
                ) : null}
              </span>

              <div className="flex gap-1.5 lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(row)
                    setOpen(true)
                  }}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Open
                </button>
                <RemoveButton row={row} />
              </div>
            </div>
          ))}

          {visible.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-n-500 m-0 text-sm">
                Nothing matches that. Clear the search or the filter.
              </p>
            </div>
          ) : null}

          <Pagination
            page={shown.page}
            pageCount={shown.pageCount}
            from={shown.from}
            to={shown.to}
            total={visible.length}
            noun="items"
            onPage={setPage}
          />
        </Panel>
      )}

      <MaintenanceDialog
        open={open}
        today={today}
        uploads={uploads}
        editing={editing}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
      />
    </DashboardMain>
  )
}

function RemoveButton({ row }: { row: MaintenanceDTO }) {
  const mutation = useDeleteMaintenance(row.id)

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      aria-label={`Remove ${row.item}`}
      onClick={() => {
        if (mutation.isPending) return
        mutation.mutate(undefined, {
          onSuccess: () => toast.success(`${row.item} removed`),
          onError: (error) => reportMutationError(error),
        })
      }}
      className="border-n-300 text-n-500 hover:text-s-overdue rounded-md border bg-white px-2 py-1.5 text-[12.5px] font-semibold"
    >
      ×
    </button>
  )
}

function MaintenanceDialog({
  open,
  today,
  uploads,
  editing,
  onClose,
}: {
  open: boolean
  today: string
  uploads: boolean
  editing: MaintenanceDTO | null
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(
          emsDialogContent,
          "max-h-[92vh] overflow-y-auto p-5 sm:max-w-[680px] sm:p-6"
        )}
      >
        {open ? (
          <Body
            today={today}
            uploads={uploads}
            editing={editing}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  today,
  uploads,
  editing,
  onClose,
}: {
  today: string
  uploads: boolean
  editing: MaintenanceDTO | null
  onClose: () => void
}) {
  const [item, setItem] = React.useState(editing?.item ?? "")
  const [makeModel, setMakeModel] = React.useState(editing?.makeModel ?? "")
  const [serialNumber, setSerialNumber] = React.useState(
    editing?.serialNumber ?? ""
  )
  const [owner, setOwner] = React.useState(editing?.owner ?? "")
  const [ownerId, setOwnerId] = React.useState(editing?.ownerId ?? "")
  const [fault, setFault] = React.useState(editing?.fault ?? "")
  const [diagnosis, setDiagnosis] = React.useState(editing?.diagnosis ?? "")
  const [status, setStatus] = React.useState<MaintenanceStatus>(
    editing?.status ?? "received"
  )
  const [receivedAt, setReceivedAt] = React.useState(
    editing?.receivedAt ?? today
  )
  const [dueAt, setDueAt] = React.useState(editing?.dueAt ?? "")
  const [returnedAt, setReturnedAt] = React.useState(editing?.returnedAt ?? "")
  const [cost, setCost] = React.useState(
    editing?.cost != null ? String(editing.cost) : ""
  )
  const [assigneeId, setAssigneeId] = React.useState(
    editing?.assignee?.id ?? ""
  )
  const [note, setNote] = React.useState(editing?.note ?? "")
  const [photos, setPhotos] = React.useState<ImageDraft[]>(() =>
    (editing?.photos ?? []).map((url) => emptyImage(url))
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [uploading, setUploading] = React.useState(false)

  const people = usePeople()
  const parties = useCustomers()
  const create = useCreateMaintenance()
  const update = useUpdateMaintenance(editing?.id ?? "")
  const mutation = editing ? update : create

  const crew = (people.data?.members ?? []).filter(
    (one) => one.status === "active"
  )

  /**
   * Save.
   *
   * Photographs upload here and nowhere else — choosing one only holds it in
   * the browser, so an abandoned form leaves nothing in the bucket.
   */
  async function submit() {
    if (mutation.isPending || uploading) return

    let urls: string[]
    setUploading(true)
    try {
      urls = await commitImages(photos, "maintenance")
    } catch (error) {
      setUploading(false)
      toast.error(
        error instanceof Error ? error.message : "A picture didn't upload"
      )
      return
    }
    setUploading(false)

    const parsed = maintenanceSchema.safeParse({
      item,
      makeModel: makeModel || null,
      serialNumber: serialNumber || null,
      owner: owner || null,
      ownerId: ownerId || null,
      fault,
      diagnosis: diagnosis || null,
      status,
      receivedAt,
      dueAt: dueAt || null,
      returnedAt: returnedAt || null,
      cost: cost === "" ? null : cost,
      assigneeId: assigneeId || null,
      photos: urls,
      note: note || null,
    })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      return
    }

    mutation.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(editing ? "Saved" : `${item} taken in`)
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
      <DialogHeader>
        <DialogTitle className="font-heading text-[19px] font-semibold">
          {editing ? editing.item : "Take an item in"}
        </DialogTitle>
        <DialogDescription className="text-n-500 text-[13.5px]">
          What came in, whose it is, and what needs repairing.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Text
            label="What is it"
            value={item}
            error={errors.item}
            onChange={setItem}
            placeholder="Submersible pump"
          />
          <Text
            label="Make and model"
            value={makeModel}
            error={errors.makeModel}
            onChange={setMakeModel}
            placeholder="Grundfos SP-17"
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Text
            label="Serial number"
            hint="The one thing telling it from an identical one."
            value={serialNumber}
            error={errors.serialNumber}
            onChange={setSerialNumber}
            placeholder="SN-449021"
          />

          <div className="flex flex-col gap-[7px]">
            <FieldLabel>Whose is it</FieldLabel>
            <select
              value={ownerId}
              onChange={(event) => {
                const id = event.target.value
                setOwnerId(id)
                const picked = (parties.data?.customers ?? []).find(
                  (one) => one.id === id
                )
                if (picked) setOwner(picked.name)
              }}
              aria-label="Whose is it — from the list"
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">Not on the ledger — type a name</option>
              {(parties.data?.customers ?? []).map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
            {!ownerId ? (
              <input
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Company or person"
                aria-label="Whose is it"
                className={inputClass}
              />
            ) : null}
          </div>
        </div>

        <Area
          label="What needs repairing"
          value={fault}
          error={errors.fault}
          onChange={setFault}
          rows={3}
          placeholder="Trips the breaker after a minute. Noisy on start."
        />

        <ImagePickerList
          label="Photographs"
          hint="How it looked on arrival. Compressed under 1 MB, and only uploaded when you save."
          values={photos}
          onChange={setPhotos}
          enabled={uploads}
          limit={8}
        />

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-[7px]">
            <FieldLabel>State</FieldLabel>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as MaintenanceStatus)
              }
              aria-label="State"
              className={cn(inputClass, "cursor-pointer")}
            >
              {MAINTENANCE_STATUSES.map((one) => (
                <option key={one} value={one}>
                  {STATUS_LABELS[one]}
                </option>
              ))}
            </select>
          </div>

          <DateField
            label="Came in"
            value={receivedAt}
            error={errors.receivedAt}
            onChange={setReceivedAt}
          />
          <DateField
            label="Promised by"
            value={dueAt}
            error={errors.dueAt}
            onChange={setDueAt}
          />
          <DateField
            label="Went back"
            value={returnedAt}
            error={errors.returnedAt}
            onChange={setReturnedAt}
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-[7px]">
            <FieldLabel>Who is on it</FieldLabel>
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              aria-label="Who is on it"
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="">Nobody yet</option>
              {crew.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>What the repair cost</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              placeholder="Once you know"
              aria-label="What the repair cost"
              aria-invalid={Boolean(errors.cost)}
              className={inputClass}
            />
            <FieldError message={errors.cost} />
          </label>
        </div>

        <Area
          label="What was found and done"
          value={diagnosis}
          error={errors.diagnosis}
          onChange={setDiagnosis}
          rows={3}
          placeholder="Optional, once it has been looked at."
        />

        <Text
          label="Note"
          value={note}
          error={errors.note}
          onChange={setNote}
          placeholder="Optional"
        />
      </div>

      <DialogFooter className="mt-1 gap-2 sm:gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-[13.5px] font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={mutation.isPending || uploading}
          className="bg-p-500 rounded-md px-4 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {uploading
            ? "Uploading pictures…"
            : mutation.isPending
              ? "Saving…"
              : editing
                ? "Save"
                : "Take it in"}
        </button>
      </DialogFooter>

      {editing && editing.cost ? (
        <p className="text-n-500 m-0 text-[12px]">
          Repair cost recorded: {money(editing.cost)}
        </p>
      ) : null}
    </>
  )
}

function Text({
  label,
  hint,
  value,
  error,
  onChange,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  error?: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={Boolean(error)}
        className={inputClass}
      />
      {hint && !error ? (
        <span className="text-n-500 text-[11.5px]">{hint}</span>
      ) : null}
      <FieldError message={error} />
    </label>
  )
}

function Area({
  label,
  value,
  error,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={Boolean(error)}
        className={cn(inputClass, "h-auto resize-y py-2.5 leading-relaxed")}
      />
      <FieldError message={error} />
    </label>
  )
}

function DateField({
  label,
  value,
  error,
  onChange,
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        aria-invalid={Boolean(error)}
        className={inputClass}
      />
      <FieldError message={error} />
    </label>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        active
          ? "bg-p-100 border-p-400 text-p-700 font-semibold"
          : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
      )}
    >
      {label}
      {count ? (
        <span className="font-mono text-[11px] opacity-70">{count}</span>
      ) : null}
    </button>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-n-400 size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}
