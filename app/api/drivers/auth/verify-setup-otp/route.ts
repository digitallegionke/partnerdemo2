/**
 * POST /api/drivers/auth/verify-setup-otp
 *
 * Verifies the one-time setup OTP (stored on the partner_drivers row), creates/links a
 * Supabase Auth user and returns a session. Driver-table access uses the service-role
 * admin client (bypasses RLS) since the driver's own JWT is not a provider member.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient, createAuthenticatedClient, createAdminClient } from '@/lib/supabase'
import { obtainDriverSessionAfterOtpVerified } from '@/lib/driver-auth-session'
import { validateAndNormalizePhone } from '@/lib/phone-validation'
import bcrypt from 'bcryptjs'

interface VerifySetupOtpRequest {
  phone: string
  otp: string
}

interface VerifySetupOtpResponse {
  success: boolean
  message: string
  session?: unknown
  driver?: unknown
}

interface ErrorResponse {
  error: string
  code?: string
}

const DUMMY_HASH = '$2b$10$zQeY5H0H0xDqK2y6Gg3yMeqXfV9f8hG1lW7mGq5N9fQ0eV8r3X9Qe'

export async function POST(
  req: NextRequest
): Promise<NextResponse<VerifySetupOtpResponse | ErrorResponse>> {
  try {
    let body: VerifySetupOtpRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { phone: rawPhone, otp } = body

    if (!rawPhone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

    const phone = validateAndNormalizePhone(rawPhone)
    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    console.log('[verify-setup-otp] Verifying setup OTP for phone:', phone)

    const admin = createAdminClient()
    if (!admin) {
      console.error('[verify-setup-otp] SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { error: 'Database error. Please try again later.' },
        { status: 500 }
      )
    }

    const { data: driverAny, error: driverErr } = await admin
      .from('partner_drivers')
      .select('*')
      .eq('phone_number', phone)
      .eq('is_deleted', false)
      .maybeSingle()

    if (driverErr) {
      console.error('[verify-setup-otp] partner_drivers lookup:', driverErr)
      return NextResponse.json(
        { error: 'Database error. Please try again later.' },
        { status: 500 }
      )
    }

    if (!driverAny?.id) {
      await bcrypt.compare(otp, DUMMY_HASH)
      return NextResponse.json({ error: 'No driver found with this phone number' }, { status: 404 })
    }

    if (!driverAny.setup_otp_hash) {
      return NextResponse.json(
        {
          error:
            'No setup OTP found for this driver. Please contact your administrator.',
        },
        { status: 400 }
      )
    }

    if (driverAny.setup_otp_used) {
      return NextResponse.json(
        {
          error:
            'Setup OTP has already been used. Please use the regular OTP login or contact your administrator.',
        },
        { status: 400 }
      )
    }

    if (
      driverAny.setup_otp_expires_at &&
      new Date(driverAny.setup_otp_expires_at as string) < new Date()
    ) {
      return NextResponse.json(
        {
          error: 'Setup OTP has expired. Please contact your administrator for a new one.',
        },
        { status: 400 }
      )
    }

    const isValid = await bcrypt.compare(otp, driverAny.setup_otp_hash as string)
    if (!isValid) {
      console.log('[verify-setup-otp] Invalid setup OTP provided')
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      )
    }

    const driverId = Number(driverAny.id)
    const driverEmail = `${phone.replace('+', '')}@driver.internal`

    let accessToken: string
    let driverSession: Awaited<ReturnType<typeof obtainDriverSessionAfterOtpVerified>>['session']
    try {
      const anon = createAnonClient()
      const { accessToken: token, session } = await obtainDriverSessionAfterOtpVerified({
        anon,
        driverEmail,
        fullName: typeof driverAny.full_name === 'string' ? driverAny.full_name : 'Driver',
        linkedAuthUserId: (driverAny.user_id as string | null) ?? null,
      })
      accessToken = token
      driverSession = session
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Session could not be created after setup OTP verification'
      console.error('[verify-setup-otp] obtainDriverSessionAfterOtpVerified:', e)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Link the auth user, mark phone verified and burn the setup code.
    const { data: authUser } = await createAuthenticatedClient(`Bearer ${accessToken}`).auth.getUser()
    const uid = authUser.user?.id

    const { data: updatedDriver, error: updateErr } = await admin
      .from('partner_drivers')
      .update({
        ...(driverAny.user_id ? {} : uid ? { user_id: uid } : {}),
        phone_verified_at: new Date().toISOString(),
        setup_otp_used: true,
      })
      .eq('id', driverId)
      .select()
      .maybeSingle()

    if (updateErr) {
      console.error('[verify-setup-otp] partner_drivers link/verify update:', updateErr)
      return NextResponse.json(
        { error: 'Failed to complete verification. Please try again.' },
        { status: 500 }
      )
    }

    const response: VerifySetupOtpResponse = {
      success: true,
      message: 'Setup OTP verified successfully. Welcome!',
      session: driverSession,
      driver: updatedDriver ?? driverAny,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[verify-setup-otp] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
