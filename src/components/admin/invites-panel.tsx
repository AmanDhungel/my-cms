"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
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
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { EmptyState, Panel } from "@/components/dashboard/ui"
import {
  reportMutationError,
  useCreateWorkspaceInvite,
  useRevokeWorkspaceInvite,
} from "@/lib/queries"
import type {
  WorkspaceInviteDTO,
  WorkspaceInviteState,
} from "@/models/workspace-invite"

const PER_PAGE = 10

const STATE_TONE: Record<WorkspaceInviteState, string> = {
  pending: "border-p-200 bg-p-100 text-p-700",
  used: "border-s-done/40 text-s-done bg-[#eefaf4]",
  revoked: "border-s-overdue/40 text-s-overdue bg-[#fdecec]",
  expired: "border-n-300 text-n-500 bg-n-100",
}

export function InvitesPanel({
  invites,
  page,
  onPage,
  onNew,
}: {
  invites: WorkspaceInviteDTO[]
  page: number
  onPage: (next: number) => void
  onNew: () => void
}) {
  const [revoking, setRevoking] = React.useState<WorkspaceInviteDTO | null>(
    null
  )
  const shown = paginate(invites, page, PER_PAGE)

  if (invites.length === 0) {
    return (
      <EmptyState
        message="No workspace invites yet. Nobody can register without one — issue a link and hand it over."
        action={
          <button
            type="button"
            onClick={onNew}
            className="bg-p-500 rounded-md px-[15px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            New invite
          </button>
        }
      />
    )
  }

  return (
    <Panel className="overflow-hidden">
      <div className="border-n-200 bg-n-100 hidden grid-cols-[1.4fr_1fr_110px_130px_120px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
        {["FOR", "BECAME", "STATE", "EXPIRES", ""].map((head) => (
          <span
            key={head}
            className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
          >
            {head}
          </span>
        ))}
      </div>

      {shown.rows.map((invite) => (
        <div
          key={invite.id}
          className={cn(
            "border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[1.4fr_1fr_110px_130px_120px] lg:items-center",
            invite.state !== "pending" && "opacity-70"
          )}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">
              {invite.email ?? "Anyone with the link"}
            </span>
            <span className="text-n-500 truncate text-xs">
              {[invite.businessName, invite.note].filter(Boolean).join(" · ") ||
                `Issued ${formatDate(invite.createdAt)}`}
            </span>
          </span>

          <span className="text-n-600 truncate text-[12.5px]">
            {invite.workspace ?? "—"}
          </span>

          <span
            className={cn(
              "w-fit rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-[0.05em] uppercase",
              STATE_TONE[invite.state]
            )}
          >
            {invite.state}
          </span>

          <span className="text-n-600 text-[12.5px]">
            {formatDate(invite.expiresAt)}
          </span>

          <div className="lg:justify-self-end">
            {invite.state === "pending" ? (
              <button
                type="button"
                onClick={() => setRevoking(invite)}
                className="border-n-300 text-s-overdue rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-[#fdecec]"
              >
                Revoke
              </button>
            ) : (
              <span className="text-n-400 text-[12px]">—</span>
            )}
          </div>
        </div>
      ))}

      <Pagination
        page={shown.page}
        pageCount={shown.pageCount}
        from={shown.from}
        to={shown.to}
        total={invites.length}
        noun="invites"
        onPage={onPage}
      />

      {revoking ? (
        <RevokeDialog
          key={revoking.id}
          invite={revoking}
          open
          onClose={() => setRevoking(null)}
        />
      ) : null}
    </Panel>
  )
}

/**
 * Issue a link. It is shown once, on the second step — only a hash reaches
 * the database, so a link that isn't copied here is gone.
 */
export function NewInviteDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[500px] sm:p-6")}
      >
        {open ? <Body onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = React.useState("")
  const [businessName, setBusinessName] = React.useState("")
  const [note, setNote] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>(
    {}
  )
  const [link, setLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const create = useCreateWorkspaceInvite()

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success("Link copied")
    } catch {
      toast.error("Copy failed — select the link and copy it manually")
    }
  }

  if (link) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            One workspace, one link
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {email ? `For ${email}` : "For whoever you send it to"}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          Send this over. It works once, expires in 14 days, and is shown only
          now — only a hash of it is stored, so it can&rsquo;t be read back.
        </p>

        <div className="border-n-300 rounded-md border bg-white p-3">
          <code className="text-n-800 font-mono text-[12.5px] break-all">
            {link}
          </code>
        </div>

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={copy}
            className="bg-p-500 rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Done
          </button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-[19px] font-semibold">
          New workspace invite
        </DialogTitle>
        <DialogDescription className="text-n-500 text-[13.5px]">
          Nobody can register without one of these.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Lock to an email</FieldLabel>
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            placeholder="Optional — e.g. owner@company.com"
            aria-invalid={Boolean(errors.email)}
            className={inputClass}
          />
          <span className="text-n-400 text-[12px]">
            Set it and only that address can use the link. Leave it empty and
            whoever opens it picks their own — still one use either way.
          </span>
          <FieldError message={errors.email} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Workspace name</FieldLabel>
          <input
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="Optional — pre-fills their form"
            className={inputClass}
          />
          <FieldError message={errors.businessName} />
        </label>

        <label className="flex flex-col gap-[7px]">
          <FieldLabel>Note</FieldLabel>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional — for your own records"
            className={cn(inputClass, "min-h-[64px] resize-y")}
          />
          <FieldError message={errors.note} />
        </label>
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
          onClick={() => {
            if (create.isPending) return
            create.mutate(
              {
                email: email || undefined,
                businessName: businessName || undefined,
                note: note || undefined,
              },
              {
                onSuccess: ({ signupUrl }) => setLink(signupUrl),
                onError: (error) =>
                  reportMutationError(error, (path, message) =>
                    setErrors((prev) => ({ ...prev, [path]: message }))
                  ),
              }
            )
          }}
          disabled={create.isPending}
          className="bg-p-500 rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
        >
          {create.isPending ? "Making…" : "Make the link"}
        </button>
      </DialogFooter>
    </>
  )
}

function RevokeDialog({
  invite,
  open,
  onClose,
}: {
  invite: WorkspaceInviteDTO
  open: boolean
  onClose: () => void
}) {
  const mutation = useRevokeWorkspaceInvite(invite.id)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Revoke this invite?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {invite.email ?? "Anyone with the link"}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          The link stops working immediately. The row stays, so the record of
          who was offered a workspace survives.
        </p>

        <DialogFooter className="gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={() => {
              if (mutation.isPending) return
              mutation.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Invite revoked")
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={mutation.isPending}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Revoking…" : "Revoke link"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
