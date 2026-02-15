import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * POST /api/drivers/location
 *
 * Driver app posts GPS coordinates. Authenticated via driver session token.
 * Inserts into driver_locations and updates drivers.last_known_lat/lng.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the driver linked to this auth user
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found for this user' }, { status: 404 })
    }

    const body = await request.json()
    const { latitude, longitude, heading, speed, accuracy, battery_level, route_id } = body

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude are required numbers' },
        { status: 400 }
      )
    }

    // Insert location record
    const { data: location, error: insertError } = await supabase
      .from('driver_locations')
      .insert({
        driver_id: driver.id,
        route_id: route_id || null,
        latitude,
        longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        accuracy: accuracy ?? null,
        battery_level: battery_level ?? null,
        recorded_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error inserting driver location:', insertError)
      return NextResponse.json({ error: 'Failed to save location' }, { status: 500 })
    }

    // Update driver's last known position
    const { error: updateError } = await supabase
      .from('drivers')
      .update({
        last_known_lat: latitude,
        last_known_lng: longitude,
        last_location_at: new Date().toISOString(),
        is_online: true,
      })
      .eq('id', driver.id)

    if (updateError) {
      console.error('Error updating driver location:', updateError)
    }

    return NextResponse.json({ success: true, location_id: location.id })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/drivers/location:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
