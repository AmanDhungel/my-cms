import type { NextRequest } from "next/server"

import { handleApiError, ok } from "@/lib/api-response"
import { requireRole } from "@/lib/auth/guards"
import type { GeocodeHit } from "@/lib/geo"

export const runtime = "nodejs"

type NominatimHit = {
  lat: string
  lon: string
  display_name: string
  type?: string
}

/**
 * Place search for the task map, proxied rather than called from the browser.
 *
 * Nominatim's usage policy asks for an identifying User-Agent, which a browser
 * won't let us set, and going through the server also keeps the lookup on the
 * same origin. Results are cached for a day: place names don't move.
 */
export async function GET(request: NextRequest) {
  try {
    // Only people who can create tasks need this, so it isn't an open proxy.
    await requireRole("owner", "supervisor")

    const query = (request.nextUrl.searchParams.get("q") ?? "").trim()

    if (query.length < 3) {
      return ok({ results: [] as GeocodeHit[] })
    }

    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", query.slice(0, 120))
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("limit", "6")

    const response = await fetch(url, {
      headers: {
        "User-Agent": "EMS field task management (self-hosted)",
        "Accept-Language": "en",
      },
      next: { revalidate: 86_400 },
    })

    if (!response.ok) {
      // A search that can't reach the provider is an empty result, not a
      // broken dialog — the map still works by clicking.
      console.error("[geocode]", response.status, await response.text())
      return ok({ results: [] as GeocodeHit[], unavailable: true })
    }

    const hits = (await response.json()) as NominatimHit[]

    return ok({
      results: hits
        .map((hit) => ({
          label: hit.display_name,
          lat: Number(hit.lat),
          lng: Number(hit.lon),
        }))
        .filter(
          (hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lng)
        ),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
