import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'
import { normalizeDeliveryStatuses } from '@/lib/deliveryStatusMapper'

/**
 * GET /api/deliveries
 * 
 * Purpose: Fetch all deliveries for the authenticated user's organization. 
 * 
 * Security:
 * 1. Verifies user is authenticated
 * 2. Gets user's organization
 * 3. Only returns deliveries from that organization
 * 
 * This prevents users from seeing other organizations' data
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization')) 

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    //  Get a user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error fetching membership:', membershipError)
      return NextResponse.json(
        { error: 'Error fetching organization membership' },
        { status: 500 }
      )
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found for this user' },
        { status: 403 }
      )
    }

    //Fetch deliveries ONLY for user's organization
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        driver:drivers (
          id,
          name,
          phone,
          vehicle_type
        )
      `)
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching deliveries:', error)
      return NextResponse.json(
        { error: 'Failed to fetch deliveries', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(normalizeDeliveryStatuses(data ?? []))

  } catch (error: any) {
    console.error('Unexpected error in GET /api/deliveries:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/deliveries
 * 
 * Purpose: Create a new delivery
 * 
 * Security:
 * 1. Verifies user is authenticated
 * 2. Validates all required fields
 * 3. Automatically sets organization_id from user's organization
 * 4. Sets created_by and updated_by to current user
 * 
 * This prevents users from:
 * - Creating deliveries for other organizations
 * - Bypassing required fields
 * - Injecting malicious data
 */
export async function POST(request: NextRequest) {
  try {
    //  Get authenticated Supabase client
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Error fetching profile' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 403 }
      )
    }

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error fetching membership:', membershipError)
      return NextResponse.json(
        { error: 'Error fetching organization membership' },
        { status: 500 }
      )
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      )
    }

    //  validate request body
    const body = await request.json()
    
    const requiredFields = ['customer_name', 'location', 'coordinates', 'item', 'phone', 'drop_time']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.coordinates) || body.coordinates.length !== 2) {
      return NextResponse.json(
        { error: 'Coordinates must be an array of [latitude, longitude]' },
        { status: 400 }
      )
    }

    const [lat, lng] = body.coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Coordinates must be numbers' },
        { status: 400 }
      )
    }

    // I'm using type assertion to bypass TypeScript strict checking
    const deliveryData: any = {
      customer_name: body.customer_name,
      location: body.location,
      coordinates: `(${lng}, ${lat})`, // PostGIS format: (longitude, latitude)
      item: body.item,
      estimated_value: body.estimated_value || null,
      weight: body.weight || null,
      phone: body.phone,
      drop_time: body.drop_time,
      status: 'pending',
      delivery_notes: body.delivery_notes || null,
      organization_id: membership.organization_id,
      created_by: profile.id,
      updated_by: profile.id,
    }

    // Insert into database
    const { data, error } = await supabase
      .from('deliveries')
      .insert(deliveryData)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating delivery:', error)
      return NextResponse.json(
        { error: 'Failed to create delivery', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to create delivery - no data returned' },
        { status: 500 }
      )
    }

    // successfully created delivery: If so
    return NextResponse.json(data, { status: 201 })
    
  } catch (error: any) {
    console.error('Unexpected error in POST /api/deliveries:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

