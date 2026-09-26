import type { ApiError } from "@/lib/api-response"

export class ApiRequestError extends Error {
  readonly status: number
  readonly fieldErrors?: Record<string, string[]>
  /** The whole JSON error body, for the few callers that need more than a message. */
  readonly body?: Record<string, unknown>

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string[]>,
    body?: Record<string, unknown>
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.fieldErrors = fieldErrors
    this.body = body
  }
}

/**
 * Thin `fetch` wrapper that throws `ApiRequestError` on non-2xx so TanStack
 * Query can drive its own error state, and so forms can replay `fieldErrors`
 * back onto the matching inputs.
 */
export async function apiFetch<TResponse>(
  path: string,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json")
  const body = isJson ? await response.json() : null

  if (!response.ok) {
    const error = (body ?? {}) as ApiError
    throw new ApiRequestError(
      error.error ?? response.statusText ?? "Request failed",
      response.status,
      error.fieldErrors,
      (body ?? undefined) as Record<string, unknown> | undefined
    )
  }

  return body as TResponse
}

export function buildQueryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}
