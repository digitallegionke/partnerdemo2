import { calculateDistance } from './route-optimization'

interface DeliveryCoords {
  id: number
  coordinates: [number, number] // [lat, lng]
  customer_name: string
  location: string
  item: string
  estimated_value?: string | null
  phone: string
  drop_time: string
  status: string
}

interface RouteWaypoint {
  lat: number
  lng: number
}

interface PrioritizedDelivery extends DeliveryCoords {
  distance_to_route_km: number
  estimated_detour_km: number
  priority_score: number
  recommended_position: number
}

/**
 * Calculate the minimum distance from a point to a polyline path.
 * Uses perpendicular distance to each segment.
 */
export function distanceToRoutePath(
  point: [number, number],
  waypoints: RouteWaypoint[]
): number {
  if (waypoints.length === 0) return Infinity
  if (waypoints.length === 1) {
    return calculateDistance(point[0], point[1], waypoints[0].lat, waypoints[0].lng)
  }

  let minDist = Infinity
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = distanceToSegment(
      point,
      [waypoints[i].lat, waypoints[i].lng],
      [waypoints[i + 1].lat, waypoints[i + 1].lng]
    )
    if (dist < minDist) minDist = dist
  }
  return minDist
}

/**
 * Distance from a point to a line segment using projection.
 */
function distanceToSegment(
  point: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): number {
  const dx = segEnd[0] - segStart[0]
  const dy = segEnd[1] - segStart[1]
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    return calculateDistance(point[0], point[1], segStart[0], segStart[1])
  }

  // Project point onto segment, clamped to [0,1]
  let t = ((point[0] - segStart[0]) * dx + (point[1] - segStart[1]) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const projLat = segStart[0] + t * dx
  const projLng = segStart[1] + t * dy

  return calculateDistance(point[0], point[1], projLat, projLng)
}

/**
 * Estimate the detour distance if a candidate delivery is inserted at
 * the optimal position in the current route.
 * Returns the best detour distance and insertion position.
 */
export function estimateDetour(
  routeDeliveryCoords: Array<[number, number]>,
  candidate: [number, number]
): { detourKm: number; bestPosition: number } {
  if (routeDeliveryCoords.length === 0) {
    return { detourKm: 0, bestPosition: 0 }
  }

  let minDetour = Infinity
  let bestPosition = routeDeliveryCoords.length

  for (let i = 0; i <= routeDeliveryCoords.length; i++) {
    const prev = i > 0 ? routeDeliveryCoords[i - 1] : null
    const next = i < routeDeliveryCoords.length ? routeDeliveryCoords[i] : null

    // Original segment distance
    const originalDist =
      prev && next
        ? calculateDistance(prev[0], prev[1], next[0], next[1])
        : 0

    // New distance via candidate
    const newDist =
      (prev ? calculateDistance(prev[0], prev[1], candidate[0], candidate[1]) : 0) +
      (next ? calculateDistance(candidate[0], candidate[1], next[0], next[1]) : 0)

    const detour = newDist - originalDist
    if (detour < minDetour) {
      minDetour = detour
      bestPosition = i
    }
  }

  return { detourKm: Math.max(0, minDetour), bestPosition }
}

/**
 * Score and rank unassigned deliveries by compatibility with a given route.
 *
 * Two-pass scoring:
 * 1. First pass: compute raw distances and detours for all deliveries
 * 2. Second pass: normalize scores relative to the actual min/max across
 *    all candidates so closer deliveries always rank higher.
 *
 * Scoring weights:
 * - 50% distance to route path (closer = better)
 * - 40% estimated detour cost (less detour = better)
 * - 10% delivery value (higher value = better, tiebreaker only)
 */
export function prioritizeDeliveries(
  unassigned: DeliveryCoords[],
  routeWaypoints: RouteWaypoint[],
  routeDeliveryCoords: Array<[number, number]>,
  _maxDetourKm: number = 3
): PrioritizedDelivery[] {
  if (unassigned.length === 0) return []

  // First pass: compute raw distances and detours
  const raw = unassigned.map((delivery) => {
    const distToRoute = distanceToRoutePath(delivery.coordinates, routeWaypoints)
    const { detourKm, bestPosition } = estimateDetour(
      routeDeliveryCoords,
      delivery.coordinates
    )
    const rawValue = parseInt(
      delivery.estimated_value?.toString().replace(/[^\d]/g, '') || '0',
      10
    )
    return { delivery, distToRoute, detourKm, bestPosition, rawValue }
  })

  // Find max distance and detour across all candidates for normalization
  const maxDist = Math.max(...raw.map((r) => r.distToRoute), 1)
  const maxDetour = Math.max(...raw.map((r) => r.detourKm), 1)
  const maxValue = Math.max(...raw.map((r) => r.rawValue), 1)

  // Second pass: score using relative normalization
  const scored: PrioritizedDelivery[] = raw.map(
    ({ delivery, distToRoute, detourKm, bestPosition, rawValue }) => {
      // Closer to route = higher score (1.0 = closest, 0.0 = farthest)
      const distanceScore = 1 - distToRoute / maxDist
      // Less detour = higher score
      const detourScore = 1 - detourKm / maxDetour
      // Higher value = higher score (tiebreaker)
      const valueScore = rawValue / maxValue

      const priorityScore =
        0.5 * distanceScore + 0.4 * detourScore + 0.1 * valueScore

      return {
        ...delivery,
        distance_to_route_km: Math.round(distToRoute * 100) / 100,
        estimated_detour_km: Math.round(detourKm * 100) / 100,
        priority_score: Math.round(priorityScore * 100) / 100,
        recommended_position: bestPosition,
      }
    }
  )

  // Sort by priority score descending (nearby/recommended ones float to top)
  scored.sort((a, b) => b.priority_score - a.priority_score)

  return scored
}
