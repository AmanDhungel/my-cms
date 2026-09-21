import { Types } from "mongoose"

import { HttpError } from "@/lib/api-response"
import { KIND_ROUTES } from "@/lib/operations"
import { Customer } from "@/models/customer"
import { Project } from "@/models/project"
import type { OperationKind } from "@/lib/work-constants"

/**
 * The bits both operation routes need. They live here rather than in the
 * route file because a route module may only export handlers and Next's
 * config fields — anything else is rejected at build time.
 */

/** What a populated operation query asks mongoose for. */
export const OPERATION_POPULATE = [
  { path: "assignees", select: "name" },
  { path: "customer", select: "name" },
  { path: "project", select: "name" },
]

/** A customer id, confirmed to belong to this workspace. */
export async function scopedCustomer(
  id: string | undefined,
  businessId: string
) {
  if (!id || !Types.ObjectId.isValid(id)) return null
  const customer = await Customer.findOne({ _id: id, business: businessId })
  if (!customer) {
    throw new HttpError(422, "That customer isn't in this workspace")
  }
  return customer
}

/** The same scoping rule for a project. */
export async function scopedProject(id: string | undefined, businessId: string) {
  if (!id || !Types.ObjectId.isValid(id)) return null
  const project = await Project.findOne({ _id: id, business: businessId })
  if (!project) {
    throw new HttpError(422, "That project isn't in this workspace")
  }
  return project
}

/** The log's second line: what kind it is, when it is, and where. */
export function describeOperation(
  kind: string,
  startAt: string,
  location?: string
) {
  return [
    kind.replace(/_/g, " "),
    new Date(startAt).toISOString().slice(0, 10),
    location,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** Where a log row for this kind should land. */
export function hrefFor(kind: string) {
  return KIND_ROUTES[kind as OperationKind] ?? "/dashboard/calendar"
}
