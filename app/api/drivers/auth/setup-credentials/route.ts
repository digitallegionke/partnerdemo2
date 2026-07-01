/**
 * POST /api/drivers/auth/setup-credentials
 *
 * Allows an authenticated driver to set a permanent email and password.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { resolveDemoSession, setDemoPasswordHash } from '@/lib/driver-auth-demo-store'
import bcrypt from 'bcryptjs'

interface SetupCredentialsRequest {
  email: string
  password: string
}

interface SetupCredentialsResponse {
  driver: unknown
}

interface ErrorResponse {
  error: string
  code?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export async function POST(
  req: NextRequest
): Promise<NextResponse<SetupCredentialsResponse | ErrorResponse>> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    // DEMO MODE: sessions are demo tokens issued by verify-otp/verify-setup-otp,
    // not real Supabase Auth JWTs. See lib/driver-auth-demo-store.ts.
    const driverId = resolveDemoSession(authHeader.slice('Bearer '.length))
    if (driverId === null) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    let body: SetupCredentialsRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    if (email.endsWith('@driver.internal')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!admin) {
      console.error('[setup-credentials] SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 })
    }

    const { data: driver, error: driverError } = await admin
      .from('partner_drivers')
      .select('*')
      .eq('id', driverId)
      .maybeSingle()

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[setup-credentials] Error fetching driver:', driverError)
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 })
    }

    if (!driver) {
      return NextResponse.json({ error: 'No driver record associated with this account' }, { status: 403 })
    }

    const { data: emailInUse } = await admin
      .from('partner_drivers')
      .select('id')
      .eq('email', email)
      .neq('id', driverId)
      .maybeSingle()

    if (emailInUse) {
      return NextResponse.json({ error: 'Email address is already in use' }, { status: 409 })
    }

    // DEMO MODE: password is stored in the in-memory demo store rather than a
    // real Supabase Auth user. See lib/driver-auth-demo-store.ts.
    setDemoPasswordHash(driverId, await bcrypt.hash(password, 10))

    const { data: updatedDriver, error: updateDriverError } = await admin
      .from('partner_drivers')
      .update({ email })
      .eq('id', driverId)
      .select()
      .single()

    if (updateDriverError) {
      console.error('[setup-credentials] Failed to update driver email:', updateDriverError)
      return NextResponse.json({ driver }, { status: 200 })
    }

    return NextResponse.json({ driver: updatedDriver }, { status: 200 })
  } catch (error: unknown) {
    console.error('[setup-credentials] Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
