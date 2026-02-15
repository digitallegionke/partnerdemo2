/**
 * GET /api/profile
 *   Returns profile, organization, and team data for the authenticated user.
 *
 * PATCH /api/profile
 *   Updates the authenticated user's profile (name, phone, email).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Error loading profile:', profileError)
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }

    // Get organization and team
    let organization = null
    let team = null

    if (profile.role === 'owner') {
      const { data: orgData, error: orgError } = await supabase
        .from('organization')
        .select('*')
        .eq('user', user.id)
        .single()

      if (!orgError && orgData) {
        organization = orgData

        const { data: allPeople } = await supabase.rpc('get_org_people', {
          p_org_id: orgData.id,
        })
        team = allPeople
      }
    } else {
      const { data: memberRecord } = await supabase
        .from('organization_members')
        .select('organization:organization_id(*)')
        .eq('user_id', user.id)
        .single()

      if (
        memberRecord &&
        memberRecord.organization &&
        !Array.isArray(memberRecord.organization)
      ) {
        organization = memberRecord.organization as any

        const { data: allPeople } = await supabase.rpc('get_org_people', {
          p_org_id: (organization as any).id,
        })
        team = allPeople
      }
    }

    return NextResponse.json({ profile, organization, team }, { status: 200 })
  } catch (error: any) {
    console.error('Error in GET /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, email } = body

    // Update auth email if changed
    if (email) {
      const { error: emailError } = await supabase.auth.updateUser({ email })
      if (emailError) {
        console.error('Auth email update error:', emailError)
        return NextResponse.json({ error: `Failed to update email: ${emailError.message}` }, { status: 400 })
      }
    }

    // Update profile record
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.full_name = name
    if (phone !== undefined) updates.phone = phone
    if (email !== undefined) updates.email = email

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Profile updated' }, { status: 200 })
  } catch (error: any) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
