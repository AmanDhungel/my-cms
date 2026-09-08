import { CardsSkeleton, HeadingSkeleton } from "@/components/dashboard/skeletons"
import { DashboardMain } from "@/components/dashboard/ui"

export default function Loading() {
  return (
    <DashboardMain className="max-w-[900px] gap-5">
      <HeadingSkeleton />
      <CardsSkeleton cards={4} />
    </DashboardMain>
  )
}
