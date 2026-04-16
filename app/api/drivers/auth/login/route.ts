/**
 * POST /api/drivers/auth/login
 *
 * Authenticates a driver using email/phone identifier and password.
 * Returns the driver record and a Supabase session.
 *
 * Body: { identifier: string, password: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient, createAuthenticatedClient } from '@/lib/supabase'
import { validateAndNormalizePhone } from '@/lib/phone-validation'

interface LoginRequest {
  identifier: string
  password: string
}

interface LoginResponse {
  driver: unknown
  session: unknown
}

interface ErrorResponse {
  error: string
  code?: string
}

function isPhoneNumber(value: string): boolean {
  return /^\+?[0-9\s\-().]{7,20}$/.test(value) && !/[@]/.test(value)
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<LoginResponse | ErrorResponse>> {
  try {
    let body: LoginRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { identifier, password } = body

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'identifier and password are required' },
        { status: 400 }
      )
    }

    let email: string

    if (isPhoneNumber(identifier)) {
      const phone = validateAndNormalizePhone(identifier)
      if (!phone) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
      }
      email = `${phone.replace('+', '')}@driver.internal`
      console.log('[driver-login] Phone login, using internal email:', email)
    } else {
      email = identifier.trim().toLowerCase()
      console.log('[driver-login] Email login:', email)
    }

    const anon = createAnonClient()

    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData?.session) {
      console.error('[driver-login] Sign-in failed:', signInError?.message)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const authUserId = signInData.session.user.id
    const authed = createAuthenticatedClient(`Bearer ${signInData.session.access_token}`)

    const { data: driver, error: driverError } = await authed
      .from('drivers')
      .select('*')
      .eq('user_id', authUserId)
      .maybeSingle()

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[driver-login] Error fetching driver:', driverError)
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 })
    }

    if (!driver) {
      console.error('[driver-login] No driver record for auth user:', authUserId)
      return NextResponse.json({ error: 'No driver found for these credentials' }, { status: 404 })
    }

    console.log('[driver-login] Driver login successful:', (driver as { id: number }).id)

    return NextResponse.json(
      { driver, session: signInData.session },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[driver-login] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
