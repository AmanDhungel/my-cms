import { NextResponse } from "next/server"
import { ZodError } from "zod"

export type ApiError = {
  error: string
  /** Field-level messages keyed by form path, ready for `form.setError`. */
  fieldErrors?: Record<string, string[]>
}

/** Thrown by route guards; `handleApiError` turns it into the right status. */
export class HttpError extends Error {
  readonly status: number
  /** Optional per-field messages, sent back as `fieldErrors`. */
  readonly fieldErrors?: ApiError["fieldErrors"]
  /** Optional response headers, e.g. Retry-After on a 429. */
  readonly headers?: Record<string, string>

  constructor(
    status: number,
    message: string,
    fieldErrors?: ApiError["fieldErrors"],
    headers?: Record<string, string>
  ) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.fieldErrors = fieldErrors
    this.headers = headers
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function fail(
  message: string,
  status = 400,
  fieldErrors?: ApiError["fieldErrors"],
  headers?: Record<string, string>
) {
  return NextResponse.json<ApiError>({ error: message, fieldErrors }, { status, headers })
}

/**
 * Maps thrown errors to a consistent JSON body so the client can rely on
 * `error`. Anything unexpected is logged on the server and answered with a
 * generic message — never its text or stack, which can carry internals.
 */
export function handleApiError(error: unknown) {
  if (error instanceof HttpError) {
    return fail(error.message, error.status, error.fieldErrors, error.headers)
  }

  if (error instanceof ZodError) {
    return fail("Validation failed", 422, z_flatten(error))
  }

  // A malformed id in the path can't name anything: the same 404 as an id
  // that exists in another workspace, so the two can't be told apart.
  if (error instanceof Error && error.name === "CastError") {
    return fail("Not found", 404)
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

/** The largest JSON body any route accepts. */
export const MAX_JSON_BYTES = 100 * 1024

/**
 * A route's JSON body, refused with 413 past MAX_JSON_BYTES — checked on the
 * declared length first, then counted while reading, so a body without a
 * Content-Length (or with a false one) can't get past it. Malformed JSON is
 * a 400. Every route reads its body through this.
 */
export async function readJson(request: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, "That request is too large")
  }
  if (!request.body) throw new HttpError(400, "Send a JSON body")

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new HttpError(413, "That request is too large")
    }
    chunks.push(value)
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks))
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, "That isn't valid JSON")
  }
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
