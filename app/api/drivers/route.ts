import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// E.164 format validation: +[country code][number]
function validatePhoneFormat(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phone)
}

type OrgScopedClient = SupabaseClient<Database>

/** Org-scoped check via RLS — same as dashboard visibility for this organization */
async function checkPhoneUniqueness(
  supabase: OrgScopedClient,
  phone: string,
  orgId: number
): Promise<{ isUnique: boolean; error?: string }> {
  const { data: existingDriver, error: driverError } = await supabase
    .from('drivers')
    .select('id')
    .match({ phone, org_id: orgId })
    .maybeSingle()

  if (driverError) {
    console.error('Error checking driver phone uniqueness:', driverError)
    return { isUnique: false, error: 'Failed to validate phone uniqueness in drivers table' }
  }

  if (existingDriver) {
    return {
      isUnique: false,
      error: `Phone number ${phone} already exists for a driver in this organization`,
    }
  }

  return { isUnique: true }
}

/**
 * Generate a secure 6-digit setup OTP for driver initial login
 */
function generateSetupOtp(): { otp: string; hash: string; expiresAt: string } {
  const otp = crypto.randomInt(100000, 999999).toString()
  const hash = bcrypt.hashSync(otp, 10)
  // Setup OTP expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return { otp, hash, expiresAt }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(
      request.headers.get('authorization')
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'No organization found for user' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        deliveries:deliveries(count)
      `)
      .eq('org_id', membership.organization_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch drivers', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}


export async function POST(request: NextRequest) {
  try {
    // Authenticate the admin making the request
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    // Get organization membership
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

    // Validate required fields
    const required = ['name', 'phone', 'vehicle_type', 'license_number']
    const missing = required.filter((f) => !body[f])
    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    // Validate phone format (E.164)
    if (!validatePhoneFormat(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone format. Use E.164 format: +[country code][number] (e.g., +254712345678)' },
        { status: 400 }
      )
    }

    const uniquenessCheck = await checkPhoneUniqueness(
      supabase,
      body.phone,
      membership.organization_id
    )
    if (!uniquenessCheck.isUnique) {
      return NextResponse.json({ error: uniquenessCheck.error }, { status: 409 })
    }

    const setupOtpData = generateSetupOtp()

    const insertPayload = {
      name: body.name,
      phone: body.phone,
      email: body.email ?? null,
      avatar_url: body.avatar_url ?? null,
      status: (body.status ?? 'active') as 'active' | 'inactive' | 'on_break',
      vehicle_type: body.vehicle_type,
      license_number: body.license_number,
      org_id: membership.organization_id,
      user_id: null as string | null,
      setup_otp_hash: setupOtpData.hash,
      setup_otp_expires_at: setupOtpData.expiresAt,
      setup_otp_used: false,
    }

    const { data: driver, error: insertError } = await supabase
      .from('drivers')
      .insert(insertPayload)
      .select()
      .maybeSingle()

    if (insertError) {
      console.error('Error creating driver:', insertError)
      const dup = insertError.message.includes('duplicate')
      const msg = dup
        ? `Phone number ${body.phone} or license number ${body.license_number} already exists`
        : insertError.message
      return NextResponse.json({ error: msg }, { status: dup ? 409 : 500 })
    }

    if (!driver) {
      return NextResponse.json({ error: 'Failed to create driver' }, { status: 500 })
    }

    return NextResponse.json(
      {
        ...driver,
        setupOtp: setupOtpData.otp,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Unexpected error in POST /api/drivers:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}




