import {
  CardsSkeleton,
  HeadingSkeleton,
  StatGridSkeleton,
} from "@/components/dashboard/skeletons"
import { DashboardMain } from "@/components/dashboard/ui"

export default function Loading() {
  return (
    <DashboardMain className="gap-5">
      <HeadingSkeleton actions={false} />
      <StatGridSkeleton count={3} />
      <CardsSkeleton cards={3} />
    </DashboardMain>
  )
}
