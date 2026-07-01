/**
 * POST /api/drivers/auth/verify-setup-otp
 *
 * Verifies the one-time setup OTP (stored on the partner_drivers row), creates/links a
 * Supabase Auth user and returns a session. Driver-table access uses the service-role
 * admin client (bypasses RLS) since the driver's own JWT is not a provider member.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { validateAndNormalizePhone } from '@/lib/phone-validation'
import {
  getDemoAuthState,
  markDemoPhoneVerified,
  markDemoSetupOtpUsed,
  buildDemoSession,
} from '@/lib/driver-auth-demo-store'
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

    const driverId = Number(driverAny.id)
    const driverEmail = `${phone.replace('+', '')}@driver.internal`

    // DEMO MODE: setup_otp_*/user_id columns aren't provisioned on
    // partner_drivers yet, so this state lives in the in-memory demo store.
    // See lib/driver-auth-demo-store.ts.
    const authState = getDemoAuthState(driverId)

    if (!authState.setupOtpHash) {
      return NextResponse.json(
        {
          error:
            'No setup OTP found for this driver. Please contact your administrator.',
        },
        { status: 400 }
      )
    }

    if (authState.setupOtpUsed) {
      return NextResponse.json(
        {
          error:
            'Setup OTP has already been used. Please use the regular OTP login or contact your administrator.',
        },
        { status: 400 }
      )
    }

    if (
      authState.setupOtpExpiresAt &&
      new Date(authState.setupOtpExpiresAt) < new Date()
    ) {
      return NextResponse.json(
        {
          error: 'Setup OTP has expired. Please contact your administrator for a new one.',
        },
        { status: 400 }
      )
    }

    const isValid = await bcrypt.compare(otp, authState.setupOtpHash)
    if (!isValid) {
      console.log('[verify-setup-otp] Invalid setup OTP provided')
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      )
    }

    // Mark phone verified and burn the setup code.
    markDemoPhoneVerified(driverId)
    markDemoSetupOtpUsed(driverId)

    const driverSession = buildDemoSession(driverId, driverEmail)

    const response: VerifySetupOtpResponse = {
      success: true,
      message: 'Setup OTP verified successfully. Welcome!',
      session: driverSession,
      driver: { ...driverAny, user_id: authState.userId, phone_verified_at: authState.phoneVerifiedAt },
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
