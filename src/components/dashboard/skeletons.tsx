import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shapes that match what's about to load, so nothing jumps when the data
 * lands. These render both as route-level `loading.tsx` (first navigation)
 * and inside components while a query is in flight (refetch, slow network).
 */

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="border-n-200 flex flex-col gap-2 rounded-xl border bg-white p-4"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function HeadingSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {actions ? <Skeleton className="h-10 w-36 rounded-md" /> : null}
    </div>
  )
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-n-200 overflow-hidden rounded-[14px] border bg-white">
      <div className="border-n-200 flex items-center justify-between border-b px-[18px] py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="border-n-200/70 flex items-center justify-between gap-4 border-b px-[18px] py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="border-n-200 flex flex-col gap-3 rounded-[14px] border bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** A crew screen: header, tiles, then cards. */
export function PhoneScreenSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="flex flex-col lg:mx-auto lg:w-full lg:max-w-[1040px] lg:px-8">
      <div className="flex flex-col gap-2 px-5 pt-4 pb-[18px] lg:px-0 lg:pt-7">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="flex flex-col gap-4 px-5 pb-6 lg:px-0">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3.5">
          {Array.from({ length: tiles }, (_, i) => (
            <div
              key={i}
              className="border-n-200 flex flex-col gap-2 rounded-[10px] border bg-white px-3 py-2.5 lg:rounded-xl lg:p-4"
            >
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
        <CardsSkeleton cards={2} />
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="border-n-200 rounded-[14px] border bg-white p-4">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    </div>
  )
}
