/**
 * POST /api/drivers/auth/verify-otp
 *
 * Identity: custom SMS OTP (bcrypt in otp_verifications) proves the driver.
 * Session: ephemeral random Supabase Auth password generated only after OTP succeeds
 * (never stored, never sent to the client). Auth Admin API is used only when an auth
 * user already exists, to set that one-time password — not for Postgres/RLS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient, createAuthenticatedClient } from '@/lib/supabase'
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

    const anon = createAnonClient()

    const { data: verificationRaw, error: fetchErr } = await anon.rpc('driver_otp_fetch_valid', {
      p_phone: phone,
    })

    if (fetchErr) {
      console.error('[verify-otp] driver_otp_fetch_valid:', fetchErr)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    const verification = verificationRaw as Record<string, unknown> | null
    if (!verification || typeof verification.id !== 'string') {
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
      await anon.rpc('driver_otp_delete', { p_id: verification.id })
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
      await anon.rpc('driver_otp_set_attempts', {
        p_id: verification.id,
        p_attempts: attempts + 1,
      })
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      )
    }

    await anon.rpc('driver_otp_delete', { p_id: verification.id })

    const { data: driverJson, error: driverRpcErr } = await anon.rpc('driver_get_by_phone_for_otp', {
      p_phone: phone,
    })

    if (driverRpcErr) {
      console.error('[verify-otp] driver_get_by_phone_for_otp:', driverRpcErr)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    const driverAny = driverJson as Record<string, unknown> | null
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
    try {
      const { accessToken: token } = await obtainDriverSessionAfterOtpVerified({
        anon,
        driverEmail,
        fullName: typeof driverAny.name === 'string' ? driverAny.name : undefined,
        linkedAuthUserId: (driverAny.user_id as string | null) ?? null,
      })
      accessToken = token
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

    const authed = createAuthenticatedClient(`Bearer ${accessToken}`)

    const { error: linkErr } = await authed.rpc('driver_apply_login_otp_success', {
      p_driver_id: driverId,
      p_phone: phone,
    })

    if (linkErr) {
      console.error('[verify-otp] driver_apply_login_otp_success:', linkErr)
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      )
    }

    const { data: userData } = await authed.auth.getUser()
    const uid = userData.user?.id
    if (uid && driverAny.status === 'pending_activation') {
      await authed.from('drivers').update({ status: 'active' }).eq('id', driverId).eq('user_id', uid)
    }

    const { data: updatedDriver } = await authed.from('drivers').select('*').eq('id', driverId).maybeSingle()

    let organization_name: string | undefined
    const orgId = (updatedDriver as { org_id?: number } | null)?.org_id
    if (orgId) {
      const { data: orgData } = await authed.from('organizations').select('name').eq('id', orgId).maybeSingle()
      organization_name = (orgData as { name?: string } | null)?.name ?? undefined
    }

    const { data: sessionData } = await authed.auth.getSession()

    const response: VerifyOtpResponse = {
      success: true,
      message: sessionData?.session ? 'OTP verified successfully' : 'OTP verified, session missing',
      session: sessionData?.session as never,
      driver: updatedDriver ?? driverAny,
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
