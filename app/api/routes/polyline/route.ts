import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * GET /api/routes/polyline?route_id=123
 * Returns the stored polyline for a route
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const routeId = request.nextUrl.searchParams.get('route_id')
    if (!routeId) {
      return NextResponse.json({ error: 'route_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('route_polylines')
      .select('*')
      .eq('route_id', parseInt(routeId))
      .maybeSingle()

    if (error) {
      console.error('Error fetching route polyline:', error)
      return NextResponse.json({ error: 'Failed to fetch polyline' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Unexpected error in GET /api/routes/polyline:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/routes/polyline
 * Saves or updates a route's polyline data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { route_id, encoded_polyline, waypoints, total_distance_m, total_duration_s } = body

    if (!route_id || !encoded_polyline || !waypoints) {
      return NextResponse.json(
        { error: 'route_id, encoded_polyline, and waypoints are required' },
        { status: 400 }
      )
    }

    // Upsert - update if exists, insert if not
    const { data: existing } = await supabase
      .from('route_polylines')
      .select('id')
      .eq('route_id', route_id)
      .maybeSingle()

    let data, error
    if (existing) {
      ({ data, error } = await supabase
        .from('route_polylines')
        .update({
          encoded_polyline,
          waypoints,
          total_distance_m: total_distance_m || null,
          total_duration_s: total_duration_s || null,
        })
        .eq('route_id', route_id)
        .select()
        .single())
    } else {
      ({ data, error } = await supabase
        .from('route_polylines')
        .insert({
          route_id,
          encoded_polyline,
          waypoints,
          total_distance_m: total_distance_m || null,
          total_duration_s: total_duration_s || null,
        })
        .select()
        .single())
    }

    if (error) {
      console.error('Error saving route polyline:', error)
      return NextResponse.json({ error: 'Failed to save polyline' }, { status: 500 })
    }

    return NextResponse.json(data, { status: existing ? 200 : 201 })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/routes/polyline:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}