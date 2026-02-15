/**
 * PATCH /api/profile/organization
 *
 * Updates the organization details.
 * Only accessible by org owners.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is org owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owners can update organization info' }, { status: 403 })
    }

    // Get organization
    const { data: org } = await supabase
      .from('organization')
      .select('id')
      .eq('user', user.id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { company_name, headquarters, industry } = body

    const updates: Record<string, any> = {}
    if (company_name !== undefined) updates.company_name = company_name
    if (headquarters !== undefined) updates.headquarters = headquarters
    if (industry !== undefined) updates.industry = industry

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('organization')
      .update(updates)
      .eq('id', org.id)

    if (updateError) {
      console.error('Organization update error:', updateError)
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Organization updated' }, { status: 200 })
  } catch (error: any) {
    console.error('Error in PATCH /api/profile/organization:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
