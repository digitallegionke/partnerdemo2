import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'
import { validateKenyanPhone } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error fetching membership:', membershipError)
      return NextResponse.json({ error: 'Error fetching organization membership' }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({ error: 'No organization found for this user' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        deliveries:deliveries(count)
      `)
      .eq('org_id', membership.organization_id)
      .order('name')

    if (error) {
      console.error('Error fetching drivers:', error)
      return NextResponse.json({ error: 'Failed to fetch drivers', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Unexpected error in GET /api/drivers:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error fetching membership:', membershipError)
      return NextResponse.json({ error: 'Error fetching organization membership' }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json({ error: 'No organization found for this user' }, { status: 403 })
    }

    const body = await request.json()

    const required = ['name', 'phone', 'vehicle_type', 'license_number']
    const missing = required.filter((f) => !body[f])
    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    // Validate phone format
    const phoneValidation = validateKenyanPhone(body.phone)
    if (!phoneValidation.valid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Invalid phone format' },
        { status: 400 }
      )
    }

    // Check if phone already exists for this organization
    const { data: existingDriver } = await supabase
      .from('drivers')
      .select('id')
      .eq('org_id', membership.organization_id)
      .eq('phone', phoneValidation.normalized)
      .limit(1)

    if (existingDriver && existingDriver.length > 0) {
      return NextResponse.json(
        { error: 'This phone number is already registered for another driver in your organization' },
        { status: 400 }
      )
    }

    const insertData: any = {
      name: body.name,
      phone: phoneValidation.normalized,
      email: body.email ?? null,
      avatar_url: body.avatar_url ?? null,
      status: body.status ?? 'active',
      vehicle_type: body.vehicle_type,
      license_number: body.license_number,
      org_id: membership.organization_id,
    }

    const { data, error } = await supabase
      .from('drivers')
      .insert(insertData)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating driver:', error)
      return NextResponse.json({ error: 'Failed to create driver', details: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to create driver - no data returned' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/drivers:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}


