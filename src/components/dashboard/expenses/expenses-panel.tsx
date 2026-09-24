"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  DateRangeFilter,
  withinRangeOfDay,
  type DateRange,
} from "@/components/dashboard/date-range-filter"
import { ExpenseDialog } from "@/components/dashboard/expenses/expense-dialog"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  EmptyState,
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
import {
  emsDialogContent,
  emsDialogOverlay,
} from "@/components/dashboard/dialog-chrome"
import { money, quantity } from "@/lib/billing"
import { shortKindLabel, kindLabel, movesStock } from "@/lib/expenses"
import {
  reportMutationError,
  useDeleteExpense,
  useExpenses,
} from "@/lib/queries"
import type { ExpenseDTO } from "@/models/expense"
import type { ExpenseKind } from "@/lib/work-constants"

const PER_PAGE = 10

/**
 * The expense ledger, on whichever page is showing it.
 *
 * The Sales page shows all of it beside what was billed, which is the only
 * place the two halves of the month meet. The Inventory page shows the stock
 * purchases alone, because that is the half that moves the shelf — same
 * component, same rows, narrower question.
 */
export function ExpensesPanel({
  today,
  kinds,
  stockOnly = false,
  revenue,
}: {
  today: string
  /** What this viewer may record. A supervisor gets stock purchases only. */
  kinds: readonly ExpenseKind[]
  /** The inventory page's view: purchases, and nothing else. */
  stockOnly?: boolean
  /**
   * Billed in the same period, when the page knows it. Turns the totals from
   * "what went out" into "what is left", which is the actual question.
   */
  revenue?: number
}) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ExpenseDTO | null>(null)
  const [deleting, setDeleting] = React.useState<ExpenseDTO | null>(null)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<ExpenseKind | "all">("all")
  const [range, setRange] = React.useState<DateRange | undefined>()
  const [page, setPage] = React.useState(1)

  // Every filter puts you back on the first page: page 4 of a list that just
  // became one page long is nothing at all.
  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  const query = useExpenses()
  const all = query.data?.expenses ?? []
  const expenses = stockOnly ? all.filter((one) => movesStock(one.kind)) : all

  const needle = search.trim().toLowerCase()
  const visible = expenses.filter((expense) => {
    if (filter !== "all" && expense.kind !== filter) return false
    if (!withinRangeOfDay(expense.spentOn, range)) return false
    if (!needle) return true
    return [
      expense.payee,
      expense.reference,
      expense.note,
      kindLabel(expense.kind),
      ...expense.lines.map((line) => line.name),
    ].some((field) => field?.toLowerCase().includes(needle))
  })

  const shown = paginate(visible, page, PER_PAGE)

  // Every total follows the filters, so what is on screen is what is added up.
  const spent = visible.reduce((sum, one) => sum + one.amount, 0)
  const onStock = visible
    .filter((one) => movesStock(one.kind))
    .reduce((sum, one) => sum + one.amount, 0)
  const running = spent - onStock

  const month = today.slice(0, 7)
  const thisMonth = expenses
    .filter((one) => one.spentOn.startsWith(month))
    .reduce((sum, one) => sum + one.amount, 0)

  /** Which kinds are actually in the ledger, so the chips aren't all twenty-one. */
  const present = [...new Set(expenses.map((one) => one.kind))].sort(
    (a, b) => tally(expenses, b) - tally(expenses, a)
  )


  function record() {
    setEditing(null)
    setOpen(true)
  }

  function correct(expense: ExpenseDTO) {
    setEditing(expense)
    setOpen(true)
  }

  return (
    <>
      {query.isPending ? (
        <StatGridSkeleton count={revenue === undefined ? 3 : 4} />
      ) : (
        <div
          className={cn(
            "grid gap-3.5 sm:grid-cols-2",
            revenue === undefined ? "xl:grid-cols-3" : "xl:grid-cols-4"
          )}
        >
          <StatCard
            label={stockOnly ? "SPENT ON STOCK" : "SPENT"}
            value={money(spent)}
            hint={
              range?.from
                ? "over the dates picked"
                : `${visible.length} entr${visible.length === 1 ? "y" : "ies"}`
            }
          />
          {stockOnly ? (
            <StatCard
              label="GOODS IN"
              value={quantity(
                visible.reduce(
                  (sum, one) =>
                    sum + one.lines.reduce((n, line) => n + line.qty, 0),
                  0
                )
              )}
              hint="units put on the shelf"
            />
          ) : (
            <StatCard
              label="RUNNING COSTS"
              value={money(running)}
              hint={
                onStock > 0
                  ? `plus ${money(onStock)} spent on stock`
                  : "nothing spent on stock"
              }
            />
          )}
          <StatCard label="THIS MONTH" value={money(thisMonth)} />
          {revenue === undefined ? null : (
            <StatCard
              label="BILLED LESS SPENT"
              value={money(revenue - spent)}
              accent={revenue - spent < 0}
              hint={`${money(revenue)} billed`}
            />
          )}
        </div>
      )}

      {query.isPending ? (
        <RowsSkeleton rows={4} />
      ) : query.isError ? (
        <EmptyState
          message="Couldn't load the expenses. Your connection may have dropped."
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
      ) : expenses.length === 0 ? (
        <EmptyState
          message={
            stockOnly
              ? "No stock purchases yet. Recording one names the items you bought, puts them on the shelf and remembers what each one cost."
              : "Nothing recorded yet. Salaries, rent, fuel, a vendor's bill — anything the business pays for goes here, and stock purchases also put the goods on the shelf."
          }
          action={
            <button
              type="button"
              onClick={record}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              {stockOnly ? "New purchase" : "New expense"}
            </button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-b px-[18px] py-3.5">
            <div className="flex flex-wrap gap-1.5">
              {present.length > 1 ? (
                <>
                  <Chip
                    label="All"
                    active={filter === "all"}
                    onClick={() => change(setFilter)("all")}
                  />
                  {present.map((one) => (
                    <Chip
                      key={one}
                      label={shortKindLabel(one)}
                      count={tally(expenses, one)}
                      active={filter === one}
                      onClick={() => change(setFilter)(one)}
                    />
                  ))}
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter value={range} onChange={change(setRange)} />
              <label className="border-n-200 bg-n-50 flex min-w-[190px] items-center gap-2 rounded-md border px-2.5 py-2">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => change(setSearch)(event.target.value)}
                  placeholder={stockOnly ? "Search purchases" : "Search expenses"}
                  className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
                />
              </label>
              <button
                type="button"
                onClick={record}
                className={primaryButtonClass}
              >
                <PlusIcon className="size-3.5" />
                {stockOnly ? "New purchase" : "New expense"}
              </button>
            </div>
          </div>

          <div className="border-n-200 bg-n-100 hidden grid-cols-[110px_1.2fr_1fr_110px_120px_92px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
            {["DATE", "PAID TO", "FOR", "HOW", "AMOUNT", ""].map((head) => (
              <span
                key={head}
                className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
              >
                {head}
              </span>
            ))}
          </div>

          {shown.rows.map((expense) => (
            <div
              key={expense.id}
              className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[110px_1.2fr_1fr_110px_120px_92px] lg:items-center"
            >
              <span className="text-n-600 text-[12.5px]">
                {shortDate(expense.spentOn)}
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {expense.payee}
                </span>
                {expense.reference || expense.note ? (
                  <span className="text-n-500 truncate text-xs">
                    {[expense.reference, expense.note]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-n-700 truncate text-[13px]">
                  {kindLabel(expense.kind)}
                </span>
                {expense.lines.length > 0 ? (
                  <span className="text-n-500 truncate text-xs">
                    {expense.lines.length === 1
                      ? `${quantity(expense.lines[0].qty)} ${expense.lines[0].unit} ${expense.lines[0].name}`
                      : `${expense.lines.length} items`}
                  </span>
                ) : null}
              </span>

              <span className="text-n-600 text-[12.5px] capitalize">
                {expense.method}
              </span>

              <span className="font-mono text-[13px] font-semibold tabular-nums">
                {money(expense.amount)}
              </span>

              <div className="flex gap-1.5 lg:justify-self-end">
                <button
                  type="button"
                  onClick={() => correct(expense)}
                  className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(expense)}
                  aria-label={`Delete the ${money(expense.amount)} to ${expense.payee}`}
                  className="border-n-300 text-n-500 hover:text-s-overdue hover:border-s-overdue/40 rounded-md border bg-white px-2 py-1.5 text-[12.5px] font-semibold"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          {visible.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-n-500 m-0 text-sm">
                Nothing matches that. Clear the search, the dates or the filter
                to see them all.
              </p>
            </div>
          ) : null}

          <Pagination
            page={shown.page}
            pageCount={shown.pageCount}
            from={shown.from}
            to={shown.to}
            total={visible.length}
            noun={stockOnly ? "purchases" : "expenses"}
            onPage={setPage}
          />
        </Panel>
      )}

      <ExpenseDialog
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        today={today}
        kinds={kinds}
        initialKind={stockOnly ? "stock" : undefined}
        editing={editing}
      />

      {deleting ? (
        <DeleteExpenseDialog
          expense={deleting}
          open
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}

function DeleteExpenseDialog({
  expense,
  open,
  onClose,
}: {
  expense: ExpenseDTO
  open: boolean
  onClose: () => void
}) {
  const mutation = useDeleteExpense(expense.id)
  const buying = movesStock(expense.kind)
  const units = expense.lines.reduce((sum, line) => sum + line.qty, 0)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        overlayClassName={emsDialogOverlay}
        className={cn(emsDialogContent, "p-5 sm:max-w-[460px] sm:p-6")}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[19px] font-semibold">
            Delete {money(expense.amount)} to {expense.payee}?
          </DialogTitle>
          <DialogDescription className="text-n-500 text-[13.5px]">
            {kindLabel(expense.kind)} · {shortDate(expense.spentOn)}
          </DialogDescription>
        </DialogHeader>

        <p className="text-n-600 m-0 text-[13.5px] leading-relaxed">
          {buying
            ? `This takes ${quantity(units)} units back off the shelf and works out what those items cost without this purchase. If any of it has been sold since, the deletion is refused rather than leaving the count negative.`
            : "This also removes the matching row from the Payments page. It can't be undone."}
        </p>

        <DialogFooter className="mt-1 gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-4 py-2.5 text-[13.5px] font-semibold"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              if (mutation.isPending) return
              mutation.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`${money(expense.amount)} to ${expense.payee} deleted`)
                  onClose()
                },
                onError: (error) => reportMutationError(error),
              })
            }}
            className="bg-s-overdue rounded-md px-4 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-[1.06] disabled:opacity-60"
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function tally(expenses: ExpenseDTO[], kind: string) {
  return expenses.filter((one) => one.kind === kind).length
}

/** "12 Mar 2026" from a "YYYY-MM-DD" day, without turning it into an instant. */
function shortDate(dayKey: string) {
  const [year, month, day] = dayKey.split("-")
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`
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
