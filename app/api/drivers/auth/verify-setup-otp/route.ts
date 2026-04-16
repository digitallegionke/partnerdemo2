/**
 * POST /api/drivers/auth/verify-setup-otp
 *
 * Verifies one-time setup OTP (stored on drivers row). Uses anon key + RPCs + Auth signUp/signIn.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient, createAuthenticatedClient } from '@/lib/supabase'
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

    const anon = createAnonClient()

    const { data: driverJson, error: driverErr } = await anon.rpc('driver_get_by_phone_for_otp', {
      p_phone: phone,
    })

    if (driverErr) {
      console.error('[verify-setup-otp] driver_get_by_phone_for_otp:', driverErr)
      return NextResponse.json(
        { error: 'Database error. Please try again later.' },
        { status: 500 }
      )
    }

    const driverAny = driverJson as Record<string, unknown> | null
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
    try {
      const { accessToken: token } = await obtainDriverSessionAfterOtpVerified({
        anon,
        driverEmail,
        fullName: typeof driverAny.name === 'string' ? driverAny.name : 'Driver',
        linkedAuthUserId: (driverAny.user_id as string | null) ?? null,
      })
      accessToken = token
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Session could not be created after setup OTP verification'
      console.error('[verify-setup-otp] obtainDriverSessionAfterOtpVerified:', e)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const authed = createAuthenticatedClient(`Bearer ${accessToken}`)

    const { error: linkErr } = await authed.rpc('driver_apply_setup_otp_success', {
      p_driver_id: driverId,
      p_phone: phone,
    })

    if (linkErr) {
      console.error('[verify-setup-otp] driver_apply_setup_otp_success:', linkErr)
      return NextResponse.json(
        { error: 'Failed to complete verification. Please try again.' },
        { status: 500 }
      )
    }

    const { data: userData } = await authed.auth.getUser()
    const uid = userData.user?.id
    if (uid && driverAny.status === 'pending_activation') {
      await authed.from('drivers').update({ status: 'active' }).eq('id', driverId).eq('user_id', uid)
    }

    const { data: updatedDriver } = await authed.from('drivers').select('*').eq('id', driverId).maybeSingle()
    const { data: sessionData } = await authed.auth.getSession()

    const response: VerifySetupOtpResponse = {
      success: true,
      message: sessionData?.session
        ? 'Setup OTP verified successfully. Welcome!'
        : 'Setup OTP verified, but session creation failed.',
      session: sessionData?.session,
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
