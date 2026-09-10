"use client"

import { cn } from "cn"

/**
 * Paging over a list that is already in memory — both Sales and Inventory
 * fetch their whole list in one request, so this only slices what is there
 * rather than asking the server for more.
 */
export function paginate<T>(rows: T[], page: number, perPage: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage))
  // A filter can shrink the list under the page you were on.
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * perPage

  return {
    page: safePage,
    pageCount,
    rows: rows.slice(start, start + perPage),
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, rows.length),
  }
}

export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  noun,
  onPage,
}: {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  /** What is being counted, e.g. "bills". */
  noun: string
  onPage: (next: number) => void
}) {
  return (
    <div className="border-n-200 flex flex-wrap items-center justify-between gap-3 border-t px-[18px] py-3">
      <span className="text-n-500 text-[13px]">
        {total === 0
          ? `No ${noun}`
          : // "of 1 items" reads like a bug, so the last one is singular.
            `Showing ${from}–${to} of ${total} ${total === 1 ? noun.replace(/s$/, "") : noun}`}
      </span>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          <Step
            label="Previous"
            glyph="‹"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          />
          {pageNumbers(page, pageCount).map((entry, index) =>
            entry === null ? (
              <span key={`gap${index}`} className="text-n-400 px-1 text-[12.5px]">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPage(entry)}
                aria-current={entry === page ? "page" : undefined}
                className={cn(
                  "min-w-[30px] rounded-md border px-2 py-1.5 font-mono text-[12.5px] transition-colors",
                  entry === page
                    ? "border-p-400 bg-p-100 text-p-700 font-semibold"
                    : "border-n-200 text-n-600 hover:bg-n-100 bg-white"
                )}
              >
                {entry}
              </button>
            )
          )}
          <Step
            label="Next"
            glyph="›"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          />
        </div>
      ) : null}
    </div>
  )
}

function Step({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string
  glyph: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-n-200 text-n-600 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[13px] disabled:opacity-40 disabled:hover:bg-white"
    >
      {glyph}
    </button>
  )
}

/**
 * First and last always show, with a window around the current page and an
 * ellipsis for whatever it skips — so the row stays the same width at page 2
 * and at page 40.
 */
function pageNumbers(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const window = new Set([1, pageCount, page, page - 1, page + 1])
  const pages = [...window]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b)

  const out: (number | null)[] = []
  let previous = 0
  for (const entry of pages) {
    if (previous && entry - previous > 1) out.push(null)
    out.push(entry)
    previous = entry
  }
  return out
}
