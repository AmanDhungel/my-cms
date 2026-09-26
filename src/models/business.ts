import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose"

import { CREW_SIZES } from "@/lib/validations/auth"
import {
  AWAY_RADIUS_M,
  OFFICE_RADIUS_M,
  PATTERN_KINDS,
} from "@/lib/work-constants"
import type { WeekPattern } from "@/lib/week"

/**
 * Where the office is, and how far from it a shift may be opened. Absent on
 * a workspace that has not pinned one — then a shift can be started from
 * anywhere, which is how every workspace behaved before this existed.
 */
const officeSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    /** What the place is called, for the settings page to show back. */
    label: { type: String, trim: true, maxlength: 200 },
    /** Inside this, someone is at the office. */
    radiusM: {
      type: Number,
      required: true,
      min: 20,
      max: 5000,
      default: OFFICE_RADIUS_M,
    },
    /** Beyond this, starting a shift has to come with a reason. */
    awayRadiusM: {
      type: Number,
      required: true,
      min: 20,
      max: 20000,
      default: AWAY_RADIUS_M,
    },
  },
  { _id: false }
)

/**
 * One day of a repeating week. A rest day carries no hours — an "off" day
 * with 09:00–17:00 on it would be a contradiction, so the API strips them.
 */
const dayPlanSchema = new Schema(
  {
    kind: { type: String, required: true, enum: PATTERN_KINDS },
    startTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
)

/** Exactly seven, Monday first. Absent means nobody has set one. */
const weekField = {
  type: [dayPlanSchema],
  /**
   * Without this mongoose creates an empty array on every new document, and
   * an empty array is not seven days — which would fail the validator below
   * on a record that simply has no week.
   */
  default: undefined,
  validate: {
    validator: (list: unknown[] | undefined) =>
      list === undefined || list.length === 0 || list.length === 7,
    message: "A week has seven days",
  },
}

/**
 * The workspace's logo, as stored. Both halves are kept: the URL is what the
 * sidebar renders, the key is what the bucket is told to delete when it is
 * replaced — deriving one from the other at delete time would tie the
 * record to whatever public base was configured on the day it was saved.
 */
const logoSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
)

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    crewSize: { type: String, required: true, enum: CREW_SIZES },
    /**
     * Day boundaries and lateness are computed here, not in the server's
     * zone: a UTC host would otherwise roll the day over mid-afternoon.
     */
    timeZone: { type: String, required: true, default: "Asia/Kathmandu" },
    office: { type: officeSchema },
    /** Absent on a workspace that shows its initials instead. */
    logo: { type: logoSchema },
    /** The standard week everyone follows unless they have their own. */
    week: weekField,
    /** PAN / VAT registration number, printed on tax invoices. */
    pan: { type: String, trim: true, maxlength: 30 },
    /** Percent added to a bill that has VAT switched on. Nepal is 13%. */
    vatRate: { type: Number, required: true, min: 0, max: 100, default: 13 },
    /**
     * The last bill number handed out. Incremented with $inc inside the
     * transaction that writes the bill, so two tills can never share a number.
     */
    billSeq: { type: Number, required: true, default: 0 },
    /**
     * Set by a super admin. A blocked workspace shuts out everyone in it,
     * whatever their role.
     */
    blockedAt: { type: Date },
    /** The user who created the workspace. */
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export type BusinessDocument = InferSchemaType<typeof businessSchema>

/**
 * `models.Business ??` keeps hot reload from re-registering the model
 * (mongoose throws OverwriteModelError otherwise).
 */
export const Business: Model<BusinessDocument> =
  (models.Business as Model<BusinessDocument>) ??
  model<BusinessDocument>("Business", businessSchema)

export type BusinessDTO = {
  id: string
  name: string
  crewSize: string
  timeZone: string
  office: {
    lat: number
    lng: number
    label: string | null
    radiusM: number
    awayRadiusM: number
  } | null
  week: WeekPattern | null
  pan: string | null
  vatRate: number
  logo: { key: string; url: string } | null
  blockedAt: string | null
  ownerId: string
}

export function toBusinessDTO(
  business: HydratedDocument<BusinessDocument>
): BusinessDTO {
  return {
    id: String(business._id),
    name: business.name,
    crewSize: business.crewSize,
    timeZone: business.timeZone,
    office: business.office
      ? {
          lat: business.office.lat,
          lng: business.office.lng,
          label: business.office.label ?? null,
          radiusM: business.office.radiusM,
          awayRadiusM: business.office.awayRadiusM,
        }
      : null,
    week: (business.week?.length === 7
      ? business.week.map((day) => ({
          kind: day.kind,
          startTime: day.startTime ?? null,
          endTime: day.endTime ?? null,
        }))
      : null) as WeekPattern | null,
    pan: business.pan ?? null,
    vatRate: business.vatRate,
    logo: business.logo
      ? { key: business.logo.key, url: business.logo.url }
      : null,
    blockedAt: business.blockedAt ? business.blockedAt.toISOString() : null,
    ownerId: String(business.owner),
  }
}
