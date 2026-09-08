import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/work-constants"

export { PROJECT_STATUSES, type ProjectStatus }

const projectSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000 },
    /** The default site for tasks in this project; each task can override it. */
    site: { type: String, trim: true, maxlength: 160 },
    status: {
      type: String,
      required: true,
      enum: PROJECT_STATUSES,
      default: "active",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// One project name per workspace, so a duplicate is caught rather than guessed at.
projectSchema.index({ business: 1, name: 1 }, { unique: true })

export type ProjectDocument = InferSchemaType<typeof projectSchema>

export const Project: Model<ProjectDocument> =
  (models.Project as Model<ProjectDocument>) ??
  model<ProjectDocument>("Project", projectSchema)

export type ProjectDTO = {
  id: string
  name: string
  description: string | null
  site: string | null
  status: ProjectStatus
  createdAt: string
}

export function toProjectDTO(
  project: HydratedDocument<ProjectDocument>
): ProjectDTO {
  return {
    id: String(project._id),
    name: project.name,
    description: project.description ?? null,
    site: project.site ?? null,
    status: project.status,
    createdAt: (project.createdAt as Date).toISOString(),
  }
}
