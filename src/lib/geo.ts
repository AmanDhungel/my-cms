/** Metres between two WGS-84 points, via the haversine formula. */
export function distanceInMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

/** "180 m" / "1.4 km" — how distances read in the UI. */
export function formatDistance(metres: number) {
  if (metres < 1000) return `${metres} m`
  return `${(metres / 1000).toFixed(1)} km`
}
