import { HeadingSkeleton } from "@/components/dashboard/skeletons"
import { DashboardMain } from "@/components/dashboard/ui"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <DashboardMain className="max-w-[980px] gap-[22px]">
      <HeadingSkeleton />
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="border-n-200 grid gap-6 rounded-[14px] border bg-white p-[22px] lg:grid-cols-[210px_1fr]"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        </div>
      ))}
    </DashboardMain>
  )
}
