/**
 * POST /api/drivers/auth/login
 *
 * Authenticates a driver using email/phone identifier and password.
 * Returns the driver record and a Supabase session.
 *
 * Body: { identifier: string, password: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { validateAndNormalizePhone } from '@/lib/phone-validation'
import { getDemoAuthState, buildDemoSession } from '@/lib/driver-auth-demo-store'
import bcrypt from 'bcryptjs'

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

    const admin = createAdminClient()
    if (!admin) {
      console.error('[driver-login] SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 })
    }

    // DEMO MODE: no real Supabase Auth user exists for drivers, so the
    // driver row is resolved directly from phone/email and the password is
    // checked against the in-memory demo store. See lib/driver-auth-demo-store.ts.
    let driverQuery = admin.from('partner_drivers').select('*').eq('is_deleted', false)
    if (isPhoneNumber(identifier)) {
      const phone = validateAndNormalizePhone(identifier)
      if (!phone) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
      }
      console.log('[driver-login] Phone login:', phone)
      driverQuery = driverQuery.eq('phone_number', phone)
    } else {
      const email = identifier.trim().toLowerCase()
      console.log('[driver-login] Email login:', email)
      driverQuery = driverQuery.eq('email', email)
    }

    const { data: driver, error: driverError } = await driverQuery.maybeSingle()

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[driver-login] Error fetching driver:', driverError)
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 })
    }

    if (!driver) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const driverId = (driver as { id: number }).id
    const authState = getDemoAuthState(driverId)

    if (!authState.passwordHash || !(await bcrypt.compare(password, authState.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    console.log('[driver-login] Driver login successful:', driverId)

    const driverEmail = (driver as { email?: string }).email ?? identifier
    const session = buildDemoSession(driverId, driverEmail)
    const responseDriver = { ...driver, user_id: authState.userId, phone_verified_at: authState.phoneVerifiedAt }

    return NextResponse.json(
      { driver: responseDriver, session },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[driver-login] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
