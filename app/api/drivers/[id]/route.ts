import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

type Params = { params: { id: string } }

async function getAuthAndMembership(authorization: string | null) {
  const supabase = createAuthenticatedClient(authorization)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 }) }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('Error fetching membership:', membershipError)
    return { errorResponse: NextResponse.json({ error: 'Error fetching organization membership' }, { status: 500 }) }
  }

  if (!membership) {
    return { errorResponse: NextResponse.json({ error: 'No organization found for this user' }, { status: 403 }) }
  }

  return { supabase, membership }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { supabase, membership, errorResponse } = await getAuthAndMembership(request.headers.get('authorization')) as any
    if (errorResponse) return errorResponse

    const id = Number(params.id)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid driver id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .eq('org_id', membership.organization_id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching driver:', error)
      return NextResponse.json({ error: 'Failed to fetch driver', details: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Unexpected error in GET /api/drivers/[id]:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { supabase, membership, errorResponse } = await getAuthAndMembership(request.headers.get('authorization')) as any
    if (errorResponse) return errorResponse

    const id = Number(params.id)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid driver id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    const allowed = new Set([
      'name',
      'phone',
      'email',
      'avatar_url',
      'status',
      'vehicle_type',
      'license_number',
    ])
    const updates: Record<string, any> = {}
    for (const key of Object.keys(body || {})) {
      if (allowed.has(key)) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Ensure row belongs to organization
    const { data: existing, error: existingErr } = await supabase
      .from('drivers')
      .select('id, org_id')
      .eq('id', id)
      .maybeSingle()
    if (existingErr) {
      console.error('Error verifying driver ownership:', existingErr)
      return NextResponse.json({ error: 'Failed to verify driver' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }
    if (existing.org_id !== membership.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('id', id)
      .eq('org_id', membership.organization_id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating driver:', error)
      return NextResponse.json({ error: 'Failed to update driver', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error in PATCH /api/drivers/[id]:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { supabase, membership, errorResponse } = await getAuthAndMembership(request.headers.get('authorization')) as any
    if (errorResponse) return errorResponse

    const id = Number(params.id)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid driver id' }, { status: 400 })
    }

    // Ensure row belongs to organization
    const { data: existing, error: existingErr } = await supabase
      .from('drivers')
      .select('id, org_id')
      .eq('id', id)
      .maybeSingle()
    if (existingErr) {
      console.error('Error verifying driver ownership:', existingErr)
      return NextResponse.json({ error: 'Failed to verify driver' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }
    if (existing.org_id !== membership.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id)
      .eq('org_id', membership.organization_id)

    if (error) {
      console.error('Error deleting driver:', error)
      return NextResponse.json({ error: 'Failed to delete driver', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error in DELETE /api/drivers/[id]:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}


