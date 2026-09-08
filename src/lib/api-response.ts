import { NextResponse } from "next/server"
import { ZodError } from "zod"

export type ApiError = {
  error: string
  /** Field-level messages keyed by form path, ready for `form.setError`. */
  fieldErrors?: Record<string, string[]>
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function fail(message: string, status = 400, fieldErrors?: ApiError["fieldErrors"]) {
  return NextResponse.json<ApiError>({ error: message, fieldErrors }, { status })
}

/** Maps thrown errors to a consistent JSON body so the client can rely on `error`. */
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, z_flatten(error))
  }

  if (isMongoDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "field"
    return fail(`That ${field} is already taken`, 409, {
      [field]: [`That ${field} is already taken`],
    })
  }

  console.error("[api]", error)
  return fail("Something went wrong", 500)
}

function z_flatten(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "root"
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return fieldErrors
}

type MongoDuplicateKeyError = { code: number; keyPattern?: Record<string, unknown> }

function isMongoDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  )
}
