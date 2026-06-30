/**
 * POST /api/drivers/auth/verify-otp
 *
 * Identity: custom SMS OTP (bcrypt in otp_verifications) proves the driver.
 * Session: ephemeral random Supabase Auth password generated only after OTP succeeds
 * (never stored, never sent to the client). Auth Admin API is used only when an auth
 * user already exists, to set that one-time password — not for Postgres/RLS.
 *
 * Driver records live in `partner_drivers`. All DB access here uses the service-role
 * admin client (bypasses RLS) because the driver's own JWT is not a provider member.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient, createAuthenticatedClient, createAdminClient } from '@/lib/supabase'
import { obtainDriverSessionAfterOtpVerified } from '@/lib/driver-auth-session'
import { validateAndNormalizePhone } from '@/lib/phone-validation'
import {
  OtpErrorCode,
  getOtpErrorMessage,
  type VerifyOtpRequest,
  type VerifyOtpResponse,
  type OtpErrorResponse,
} from '@/lib/otp-types'
import bcrypt from 'bcryptjs'

const DUMMY_HASH = '$2b$10$zQeY5H0H0xDqK2y6Gg3yMeqXfV9f8hG1lW7mGq5N9fQ0eV8r3X9Qe'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: VerifyOtpRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      )
    }

    const { phone: rawPhone, otp } = body

    if (!rawPhone || !otp) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      )
    }

    const phone = validateAndNormalizePhone(rawPhone)
    if (!phone) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      )
    }

    console.log('[verify-otp] Verifying OTP for phone:', phone)

    const admin = createAdminClient()
    if (!admin) {
      console.error('[verify-otp] SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    // Fetch the newest non-expired login code for this phone.
    const { data: verification, error: fetchErr } = await admin
      .from('otp_verifications')
      .select('*')
      .eq('phone', phone)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchErr) {
      console.error('[verify-otp] otp_verifications fetch:', fetchErr)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    if (!verification?.id) {
      await bcrypt.compare(otp, DUMMY_HASH)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.EXPIRED_OTP),
          code: OtpErrorCode.EXPIRED_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      )
    }

    const attempts = (verification.attempts as number) ?? 0
    if (attempts >= 3) {
      await admin.from('otp_verifications').delete().eq('id', verification.id)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.RATE_LIMIT_EXCEEDED),
          code: OtpErrorCode.RATE_LIMIT_EXCEEDED,
        } as OtpErrorResponse,
        { status: 429 }
      )
    }

    const isValid = await bcrypt.compare(otp, verification.otp_hash as string)

    if (!isValid) {
      await admin
        .from('otp_verifications')
        .update({ attempts: attempts + 1 })
        .eq('id', verification.id)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      )
    }

    // Code is correct — consume it.
    await admin.from('otp_verifications').delete().eq('id', verification.id)

    const { data: driverAny, error: driverErr } = await admin
      .from('partner_drivers')
      .select('*')
      .eq('phone_number', phone)
      .eq('is_deleted', false)
      .maybeSingle()

    if (driverErr) {
      console.error('[verify-otp] partner_drivers lookup:', driverErr)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    if (!driverAny?.id) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.PHONE_NOT_REGISTERED),
          code: OtpErrorCode.PHONE_NOT_REGISTERED,
        } as OtpErrorResponse,
        { status: 404 }
      )
    }

    const driverId = Number(driverAny.id)
    const driverEmail = `${phone.replace('+', '')}@driver.internal`
    const isFirstLogin = !driverAny.user_id

    let accessToken: string
    let driverSession: Awaited<ReturnType<typeof obtainDriverSessionAfterOtpVerified>>['session']
    try {
      const anon = createAnonClient()
      const { accessToken: token, session } = await obtainDriverSessionAfterOtpVerified({
        anon,
        driverEmail,
        fullName: typeof driverAny.full_name === 'string' ? driverAny.full_name : undefined,
        linkedAuthUserId: (driverAny.user_id as string | null) ?? null,
      })
      accessToken = token
      driverSession = session
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Session could not be created after OTP verification'
      console.error('[verify-otp] obtainDriverSessionAfterOtpVerified:', e)
      return NextResponse.json(
        {
          error: msg,
          code: OtpErrorCode.SUPABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    // Link the auth user to the driver (if not already) and mark the phone verified.
    const { data: authUser } = await createAuthenticatedClient(`Bearer ${accessToken}`).auth.getUser()
    const uid = authUser.user?.id

    const { data: updatedDriver, error: updateErr } = await admin
      .from('partner_drivers')
      .update({
        ...(driverAny.user_id ? {} : uid ? { user_id: uid } : {}),
        phone_verified_at: new Date().toISOString(),
      })
      .eq('id', driverId)
      .select()
      .maybeSingle()

    if (updateErr) {
      console.error('[verify-otp] partner_drivers link/verify update:', updateErr)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    // Resolve the provider name for display (mirrors organization_name in the source flow).
    let organization_name: string | undefined
    const providerId = (updatedDriver as { provider_id?: number } | null)?.provider_id
    if (providerId) {
      const { data: providerData } = await admin
        .from('partner_providers')
        .select('provider_name')
        .eq('id', providerId)
        .maybeSingle()
      organization_name = (providerData as { provider_name?: string } | null)?.provider_name ?? undefined
    }

    const response: VerifyOtpResponse = {
      success: true,
      message: 'OTP verified successfully',
      session: driverSession as never,
      driver: (updatedDriver ?? driverAny) as never,
      isFirstLogin,
      organization_name,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[verify-otp] Unexpected error:', error)
    return NextResponse.json(
      {
        error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
        code: OtpErrorCode.SUPABASE_ERROR,
      } as OtpErrorResponse,
      { status: 500 }
    )
  }
}
