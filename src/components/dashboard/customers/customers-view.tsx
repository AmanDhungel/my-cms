"use client"

import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { CustomerDialog } from "@/components/dashboard/customers/customer-dialog"
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
import { money } from "@/lib/billing"
import {
  reportMutationError,
  useBills,
  useCustomers,
  useDeleteCustomer,
} from "@/lib/queries"
import type { BillDTO } from "@/models/bill"
import type { CustomerDTO } from "@/models/customer"

const PER_PAGE = 10

type Standing = { bills: number; billed: number; due: number }

/** Everyone the workspace bills, and where each of them stands. */
export function CustomersView() {
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomerDTO | null>(null)
  const [deleting, setDeleting] = React.useState<CustomerDTO | null>(null)

  const query = useCustomers()
  const bills = useBills()

  const customers = query.data?.customers ?? []
  const standing = standingOf(customers, bills.data?.bills ?? [])

  const needle = search.trim().toLowerCase()
  const visible = customers.filter((customer) =>
    !needle
      ? true
      : [
          customer.name,
          customer.company,
          customer.phone,
          customer.email,
          customer.location,
        ].some((field) => field?.toLowerCase().includes(needle))
  )

  const shown = paginate(visible, page, PER_PAGE)

  const totals = customers.reduce(
    (sum, customer) => {
      const row = standing.get(customer.id)
      return {
        billed: sum.billed + (row?.billed ?? 0),
        due: sum.due + (row?.due ?? 0),
        owing: sum.owing + ((row?.due ?? 0) > 0 ? 1 : 0),
      }
    },
    { billed: 0, due: 0, owing: 0 }
  )

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Sales & stock"
        title="Parties"
        subtitle="Customers and suppliers. Save them once, pick them on a bill or a payment, and each one keeps a running account."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={primaryButtonClass}
          >
            <PlusIcon className="size-3.5" />
            New customer
          </button>
        }
      />

      {query.isPending ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="CUSTOMERS" value={customers.length} />
          <StatCard label="BILLED" value={money(totals.billed)} />
          <StatCard
            label="STILL OWED"
            value={money(totals.due)}
            accent={totals.due > 0}
          />
          <StatCard label="OWING" value={totals.owing} />
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the customers. Your connection may have dropped."
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
      ) : customers.length === 0 ? (
        <EmptyState
          message="No customers yet. Add one and their details fill themselves in on every bill you raise for them."
          action={
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={primaryButtonClass}
            >
              New customer
            </button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-4 border-b px-[18px] py-3.5">
            <h2 className="font-heading m-0 text-base font-semibold">
              Everyone you bill
            </h2>
            <label className="border-n-200 bg-n-50 flex min-w-[210px] items-center gap-2 rounded-md border px-2.5 py-2">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search customers"
                className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
              />
            </label>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[1.3fr_1fr_1fr_80px_120px_130px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["CUSTOMER", "CONTACT", "LOCATION", "BILLS", "DUE", ""].map(
              (head) => (
                <span
                  key={head}
                  className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
                >
                  {head}
                </span>
              )
            )}
          </div>

          {shown.rows.map((customer) => {
            const row = standing.get(customer.id)

            return (
              <div
                key={customer.id}
                className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[1.3fr_1fr_1fr_80px_120px_130px] lg:items-center"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">
                    {customer.name}
                  </span>
                  <span className="text-n-500 truncate text-xs">
                    {customer.company ?? customer.pan ?? "—"}
                  </span>
                </span>

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-n-700 truncate font-mono text-[12.5px]">
                    {customer.phone ?? "—"}
                  </span>
                  <span className="text-n-500 truncate text-xs">
                    {customer.email ?? ""}
                  </span>
                </span>

                <span className="text-n-600 truncate text-[12.5px]">
                  {customer.location ?? "—"}
                </span>

                <span className="text-n-700 font-mono text-[12.5px]">
                  {row?.bills ?? 0}
                </span>

                <span
                  className={cn(
                    "font-mono text-[13px] tabular-nums",
                    (row?.due ?? 0) > 0
                      ? "text-s-overdue font-semibold"
                      : "text-n-400"
                  )}
                >
                  {money(row?.due ?? 0)}
                </span>

                <div className="flex gap-2 lg:justify-end">
                  <Link
                    href={`/dashboard/customers/${customer.id}`}
                    className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                  >
                    Ledger
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditing(customer)}
                    className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(customer)}
                    className="border-n-300 text-s-overdue rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-[#fdecec]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}

          {visible.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-n-500 m-0 text-sm">
                Nobody matches that. Clear the search to see them all.
              </p>
            </div>
          ) : null}

          <Pagination
            page={shown.page}
            pageCount={shown.pageCount}
            from={shown.from}
            to={shown.to}
            total={visible.length}
            noun="parties"
            onPage={setPage}
          />
        </Panel>
      )}

      <CustomerDialog open={open} onClose={() => setOpen(false)} />

      {editing ? (
        <CustomerDialog
          key={editing.id}
          open
          customer={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteDialog
          key={deleting.id}
          customer={deleting}
          standing={standing.get(deleting.id)}
          open
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </DashboardMain>
  )
}

function DeleteDialog({
  customer,
  standing,
  open,
  onClose,
}: {
  customer: CustomerDTO
  standing?: Standing
  open: boolean
  onClose: () => void
}) {
  const mutation = useDeleteCustomer(customer.id)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[440px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Delete {customer.name}?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {customer.company ?? customer.phone ?? "Customer record"}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          {standing && standing.bills > 0
            ? `Their ${standing.bills} bill${standing.bills === 1 ? "" : "s"} stay exactly as they are — each carries its own copy of the name and address. Only the saved record goes, so you would have to type them again next time.`
            : "Only the saved record goes. Nothing else points at it."}
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
                  toast.success(`${customer.name} deleted`)
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            disabled={mutation.isPending}
            className="bg-s-overdue rounded-md px-[18px] py-2.5 text-sm font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Deleting…" : "Delete customer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What each customer has been billed and still owes. A bill raised before
 * they were saved carries no reference, so those are matched on the name it
 * was written under.
 */
function standingOf(customers: CustomerDTO[], bills: BillDTO[]) {
  const byId = new Map<string, Standing>()
  const byName = new Map<string, string>()

  for (const customer of customers) {
    byId.set(customer.id, { bills: 0, billed: 0, due: 0 })
    byName.set(customer.name.toLowerCase(), customer.id)
  }

  for (const bill of bills) {
    if (bill.status === "void" || bill.payment === "quotation") continue

    const id =
      (bill.customerId && byId.has(bill.customerId) ? bill.customerId : null) ??
      byName.get(bill.customer.name.toLowerCase())

    const row = id ? byId.get(id) : undefined
    if (!row) continue

    row.bills += 1
    row.billed += bill.total
    row.due += bill.due
  }

  return byId
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
