import {
  HeadingSkeleton,
  RowsSkeleton,
  StatGridSkeleton,
} from "@/components/dashboard/skeletons"
import { DashboardMain } from "@/components/dashboard/ui"

export default function Loading() {
  return (
    <DashboardMain className="gap-5">
      <HeadingSkeleton />
      <StatGridSkeleton />
      <RowsSkeleton rows={6} />
    </DashboardMain>
  )
}
