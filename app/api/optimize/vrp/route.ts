import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient, parsePointCoordinates } from '@/lib/supabase'

const OR_TOOLS_SERVICE_URL = process.env.OR_TOOLS_SERVICE_URL || 'http://localhost:8000'
const MAPS_API_KEY = process.env.MAPS_PLATFORM_API_KEY || process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY

/**
 * POST /api/optimize/vrp
 *
 * Triggers OR-Tools VRP optimization:
 * 1. Fetches routes, deliveries, and drivers from Supabase
 * 2. Builds a distance/time matrix via Google Distance Matrix API
 * 3. Sends the problem to the Python OR-Tools microservice
 * 4. Returns the optimized solution
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      route_ids,
      depot = { lat: -1.2921, lng: 36.8219 }, // Default: Nairobi CBD
      vehicle_count,
      max_stops_per_vehicle = 20,
      max_duration_minutes = 480,
      include_unassigned = false,
    } = body

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }

    // Fetch routes
    let routesQuery = supabase
      .from('routes')
      .select('*, drivers(id, name, vehicle_type)')
      .eq('organization_id', membership.organization_id)

    if (route_ids && route_ids.length > 0) {
      routesQuery = routesQuery.in('id', route_ids)
    } else {
      routesQuery = routesQuery.in('status', ['active', 'pending'])
    }

    const { data: routes, error: routesError } = await routesQuery
    if (routesError) {
      return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 })
    }

    // Fetch deliveries for these routes
    const routeIdList = (routes || []).map((r: any) => r.id)
    let deliveriesQuery = supabase
      .from('deliveries')
      .select('*')
      .eq('organization_id', membership.organization_id)

    if (include_unassigned) {
      // Include both route-assigned and unassigned deliveries
      deliveriesQuery = deliveriesQuery.or(
        `route_id.in.(${routeIdList.join(',')}),route_id.is.null`
      )
      deliveriesQuery = deliveriesQuery.in('status', ['pending', 'in-progress'])
    } else {
      deliveriesQuery = deliveriesQuery.in('route_id', routeIdList)
    }

    const { data: deliveries, error: deliveriesError } = await deliveriesQuery
    if (deliveriesError) {
      return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
    }

    if (!deliveries || deliveries.length === 0) {
      return NextResponse.json({ error: 'No deliveries to optimize' }, { status: 400 })
    }

    // Build coordinates array: [depot, delivery1, delivery2, ...]
    const coords: Array<{ lat: number; lng: number }> = [
      { lat: depot.lat, lng: depot.lng },
    ]
    const deliveryIds: number[] = [0] // depot placeholder

    for (const d of deliveries) {
      const [lat, lng] = parsePointCoordinates(d.coordinates)
      coords.push({ lat, lng })
      deliveryIds.push(d.id)
    }

    // Build distance/time matrix using Google Distance Matrix API
    const matrix = await buildDistanceMatrix(coords)

    if (!matrix) {
      // Fallback to Haversine-based matrix
      const fallbackMatrix = buildHaversineMatrix(coords)
      // Use same matrix for both distance and time (rough estimate)
      const timeMatrix = fallbackMatrix.map(row =>
        row.map(d => Math.round((d / 30000) * 3600)) // 30 km/h average
      )

      return await callOrToolsAndReturn(
        fallbackMatrix,
        timeMatrix,
        deliveryIds,
        deliveries,
        routes || [],
        vehicle_count || routeIdList.length || 1,
        max_stops_per_vehicle,
        max_duration_minutes
      )
    }

    return await callOrToolsAndReturn(
      matrix.distances,
      matrix.durations,
      deliveryIds,
      deliveries,
      routes || [],
      vehicle_count || routeIdList.length || 1,
      max_stops_per_vehicle,
      max_duration_minutes
    )
  } catch (error: any) {
    console.error('Unexpected error in POST /api/optimize/vrp:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Call the OR-Tools microservice and return the result.
 */
async function callOrToolsAndReturn(
  distanceMatrix: number[][],
  timeMatrix: number[][],
  deliveryIds: number[],
  deliveries: any[],
  routes: any[],
  vehicleCount: number,
  maxStops: number,
  maxDurationMinutes: number,
) {
  const numVehicles = Math.max(1, vehicleCount)
  const vehicleCapacities = Array(numVehicles).fill(maxStops)
  const demands = deliveryIds.map((_, i) => (i === 0 ? 0 : 1)) // depot = 0, each delivery = 1

  try {
    const orToolsResponse = await fetch(`${OR_TOOLS_SERVICE_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distance_matrix: distanceMatrix,
        time_matrix: timeMatrix,
        demands,
        vehicle_capacities: vehicleCapacities,
        num_vehicles: numVehicles,
        depot_index: 0,
        max_route_duration: maxDurationMinutes * 60,
        delivery_ids: deliveryIds,
      }),
    })

    if (!orToolsResponse.ok) {
      const errorText = await orToolsResponse.text()
      console.error('OR-Tools service error:', errorText)
      return NextResponse.json(
        { error: 'Optimization service error', details: errorText },
        { status: 502 }
      )
    }

    const solution = await orToolsResponse.json()

    // Map solution back to route/delivery IDs
    const mappedSolutions = solution.solutions.map((s: any, idx: number) => {
      const routeForVehicle = routes[idx] || null
      return {
        route_id: routeForVehicle?.id || null,
        vehicle_index: s.vehicle_index,
        ordered_delivery_ids: s.ordered_delivery_ids,
        total_distance_m: s.total_distance_m,
        total_duration_s: s.total_duration_s,
        total_distance_km: Math.round(s.total_distance_m / 100) / 10,
        total_duration_min: Math.round(s.total_duration_s / 60),
      }
    })

    return NextResponse.json({
      solutions: mappedSolutions,
      dropped_deliveries: solution.dropped_nodes,
      status: solution.status,
      computation_time_ms: solution.computation_time_ms,
    })
  } catch (error: any) {
    console.error('Failed to reach OR-Tools service:', error)
    return NextResponse.json(
      { error: 'Could not connect to optimization service. Is it running?', details: error.message },
      { status: 503 }
    )
  }
}

/**
 * Build distance/time matrix using Google Distance Matrix API.
 * Returns null if the API call fails.
 */
async function buildDistanceMatrix(
  coords: Array<{ lat: number; lng: number }>
): Promise<{ distances: number[][]; durations: number[][] } | null> {
  if (!MAPS_API_KEY) return null

  try {
    // Google Distance Matrix API supports max 25 origins x 25 destinations
    const n = coords.length
    if (n > 25) {
      // For larger problems, fall back to Haversine
      return null
    }

    const origins = coords.map(c => `${c.lat},${c.lng}`).join('|')
    const destinations = origins

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${MAPS_API_KEY}&mode=driving`

    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.status)
      return null
    }

    const distances: number[][] = []
    const durations: number[][] = []

    for (const row of data.rows) {
      const distRow: number[] = []
      const durRow: number[] = []
      for (const element of row.elements) {
        if (element.status === 'OK') {
          distRow.push(element.distance.value) // meters
          durRow.push(element.duration.value)   // seconds
        } else {
          distRow.push(999999) // large number for unreachable
          durRow.push(999999)
        }
      }
      distances.push(distRow)
      durations.push(durRow)
    }

    return { distances, durations }
  } catch (error) {
    console.error('Error building distance matrix:', error)
    return null
  }
}

/**
 * Fallback: Build distance matrix using Haversine formula.
 * Returns distances in meters.
 */
function buildHaversineMatrix(
  coords: Array<{ lat: number; lng: number }>
): number[][] {
  const n = coords.length
  const matrix: number[][] = []

  for (let i = 0; i < n; i++) {
    const row: number[] = []
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(0)
      } else {
        const d = haversineDistance(
          coords[i].lat, coords[i].lng,
          coords[j].lat, coords[j].lng
        )
        row.push(Math.round(d * 1000)) // convert km to meters
      }
    }
    matrix.push(row)
  }

  return matrix
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}