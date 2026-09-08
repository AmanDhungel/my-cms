import {
  HeadingSkeleton,
  RowsSkeleton,
  StatGridSkeleton,
} from "@/components/dashboard/skeletons"
import { DashboardMain } from "@/components/dashboard/ui"

/**
 * Shown on the first navigation into the dashboard, before the server
 * component's data resolves. Nested routes override it with their own shape.
 */
export default function Loading() {
  return (
    <DashboardMain>
      <HeadingSkeleton />
      <StatGridSkeleton />
      <RowsSkeleton rows={4} />
    </DashboardMain>
  )
}
