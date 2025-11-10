import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/supabase'

// Validation schemas
const createCollectionPointSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  address: z.string().min(1, 'Address is required').max(200, 'Address too long'),
  type: z.enum(['warehouse', 'depot', 'pickup_point', 'hub']), 
  capacity: z.number().min(1, 'Capacity must be at least 1').max(10000, 'Capacity too large'),
  openingHours: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format'),
  closingHours: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format'),
  contactPerson: z.string().min(1, 'Contact person is required').max(100, 'Name too long'),
  phone: z.string().min(1, 'Phone is required').max(20, 'Phone too long'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  description: z.string().max(500, 'Description too long').optional().or(z.literal(''))
})

// GET /api/collection-points
export async function GET(request: Request) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { searchParams } = new URL(request.url)

    let query = supabase.from('collection_points').select('*')

    // Apply filters if present
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/collection-points error:', error)
    
    if (error instanceof Error && error.message === 'Authorization header required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection points' },
      { status: 500 }
    )
  }
}

// POST /api/collection-points
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Invalid or expired token')

    // Get profile.id and organization_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile query error:', profileError)
      throw new Error('Profile not found')
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      console.error('Organization membership query error:', membershipError)
      throw new Error('Organization membership not found')
    }

    // Validate the request body
    const validation = createCollectionPointSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.error.issues },
        { status: 400 }
      )
    }

    // Prepare and insert data
    const { data, error } = await supabase
      .from('collection_points')
      .insert([{
        ...validation.data,
        organization_id: membership.organization_id,
        created_by: profile.id,
        updated_by: profile.id,
        user_id: user.id,
        assignmentVehicles: 0,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/collection-points error:', error)
    
    if (error instanceof Error) {
      if (error.message === 'Authorization header required') {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'Invalid or expired token') {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'Profile not found') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'Organization membership not found') {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create collection point' },
      { status: 500 }
    )
  }
}
