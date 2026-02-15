import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * GET /api/drivers/locations
 *
 * Dashboard fetches latest positions for all drivers in the org.
 * Returns drivers with their last known location.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 })
    }

    // Get all drivers in the org with their last known location
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select('id, name, phone, vehicle_type, status, last_known_lat, last_known_lng, last_location_at, is_online')
      .eq('org_id', membership.organization_id)

    if (driversError) {
      console.error('Error fetching driver locations:', driversError)
      return NextResponse.json({ error: 'Failed to fetch driver locations' }, { status: 500 })
    }

    // Also get the most recent route_id for each online driver from driver_locations
    const onlineDriverIds = (drivers || [])
      .filter(d => d.is_online && d.last_known_lat != null)
      .map(d => d.id)

    let routeAssignments = new Map<number, number | null>()
    if (onlineDriverIds.length > 0) {
      // For each online driver, get their latest location record with route_id
      const { data: latestLocations } = await supabase
        .from('driver_locations')
        .select('driver_id, route_id')
        .in('driver_id', onlineDriverIds)
        .order('recorded_at', { ascending: false })
        .limit(onlineDriverIds.length)

      if (latestLocations) {
        const seen = new Set<number>()
        for (const loc of latestLocations) {
          if (!seen.has(loc.driver_id)) {
            seen.add(loc.driver_id)
            routeAssignments.set(loc.driver_id, loc.route_id)
          }
        }
      }
    }

    const result = (drivers || [])
      .filter(d => d.last_known_lat != null && d.last_known_lng != null)
      .map(d => ({
        driver_id: d.id,
        name: d.name,
        lat: d.last_known_lat!,
        lng: d.last_known_lng!,
        heading: null as number | null,
        speed: null as number | null,
        route_id: routeAssignments.get(d.id) ?? null,
        recorded_at: d.last_location_at,
        is_online: d.is_online,
      }))

    return NextResponse.json({ drivers: result })
  } catch (error: any) {
    console.error('Unexpected error in GET /api/drivers/locations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
