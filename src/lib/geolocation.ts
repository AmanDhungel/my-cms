export type Fix = { lat: number; lng: number; accuracyM: number }

export class LocationError extends Error {
  readonly kind: "unsupported" | "denied" | "unavailable" | "timeout"

  constructor(kind: LocationError["kind"], message: string) {
    super(message)
    this.name = "LocationError"
    this.kind = kind
  }
}

/**
 * One position fix, with every failure turned into something a person can act
 * on. `enableHighAccuracy` matters here: a coarse network fix can be hundreds
 * of metres out, which would read as being outside a 50 m geofence.
 */
export function getCurrentFix(timeoutMs = 15_000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(
        new LocationError(
          "unsupported",
          "This device can't share a location. Ask your owner to check you in."
        )
      )
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        }),
      (error) => reject(toLocationError(error)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    )
  })
}

function toLocationError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new LocationError(
        "denied",
        "Location is blocked. Allow it for this site, then try again."
      )
    case error.POSITION_UNAVAILABLE:
      return new LocationError(
        "unavailable",
        "No position yet. Step outside or turn GPS on and try again."
      )
    case error.TIMEOUT:
      return new LocationError(
        "timeout",
        "Finding you took too long. Try again with a clearer view of the sky."
      )
    default:
      return new LocationError("unavailable", "Could not read your location.")
  }
}
