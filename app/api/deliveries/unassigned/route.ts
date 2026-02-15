import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient, parsePointCoordinates } from '@/lib/supabase'
import { prioritizeDeliveries } from '@/lib/delivery-prioritization'

/**
 * GET /api/deliveries/unassigned?route_id=123&max_detour_km=3&limit=50
 *
 * Returns unassigned deliveries. If route_id is provided, scores and ranks
 * them by compatibility with that route using proximity and detour analysis.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }

    const routeId = request.nextUrl.searchParams.get('route_id')
    const maxDetourKm = parseFloat(request.nextUrl.searchParams.get('max_detour_km') || '3')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

    // Fetch all unassigned pending deliveries for this org
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('deliveries')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .is('route_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100)

    if (deliveriesError) {
      console.error('Error fetching unassigned deliveries:', deliveriesError)
      return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
    }

    if (!deliveries || deliveries.length === 0) {
      return NextResponse.json({ deliveries: [] })
    }

    // Parse coordinates for all deliveries
    const parsedDeliveries = deliveries.map((d) => {
      const [lat, lng] = parsePointCoordinates(d.coordinates)
      return {
        id: d.id,
        customer_name: d.customer_name,
        location: d.location,
        coordinates: [lat, lng] as [number, number],
        item: d.item,
        estimated_value: d.estimated_value,
        phone: d.phone,
        drop_time: d.drop_time,
        status: d.status,
      }
    })

    // If no route_id, return all unassigned without scoring
    if (!routeId) {
      return NextResponse.json({
        deliveries: parsedDeliveries.slice(0, limit).map((d) => ({
          ...d,
          distance_to_route_km: null,
          estimated_detour_km: null,
          priority_score: null,
          recommended_position: null,
        })),
      })
    }

    // Fetch route polyline for scoring
    const { data: polyline } = await supabase
      .from('route_polylines')
      .select('waypoints')
      .eq('route_id', parseInt(routeId))
      .maybeSingle()

    // Fetch route's existing deliveries for detour estimation
    const { data: routeDeliveries } = await supabase
      .from('deliveries')
      .select('coordinates, order_index')
      .eq('route_id', parseInt(routeId))
      .order('order_index', { ascending: true })

    const routeDeliveryCoords: Array<[number, number]> = (routeDeliveries || []).map((d) => {
      const [lat, lng] = parsePointCoordinates(d.coordinates)
      return [lat, lng] as [number, number]
    })

    const waypoints = polyline?.waypoints || []

    // If we have no polyline waypoints, use route delivery coordinates as waypoints
    const effectiveWaypoints =
      waypoints.length > 0
        ? waypoints
        : routeDeliveryCoords.map(([lat, lng]) => ({ lat, lng }))

    if (effectiveWaypoints.length === 0) {
      // No waypoints to score against, return unscored
      return NextResponse.json({
        deliveries: parsedDeliveries.slice(0, limit).map((d) => ({
          ...d,
          distance_to_route_km: null,
          estimated_detour_km: null,
          priority_score: null,
          recommended_position: null,
        })),
      })
    }

    // Score and rank
    const prioritized = prioritizeDeliveries(
      parsedDeliveries,
      effectiveWaypoints,
      routeDeliveryCoords,
      maxDetourKm
    )

    return NextResponse.json({ deliveries: prioritized.slice(0, limit) })
  } catch (error: any) {
    console.error('Unexpected error in GET /api/deliveries/unassigned:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
