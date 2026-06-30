/**
 * POST /api/drivers/auth/setup-credentials
 *
 * Allows an authenticated driver to set a permanent email and password.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient, createAdminClient } from '@/lib/supabase'

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

    let userSupabase: ReturnType<typeof createAuthenticatedClient>
    try {
      userSupabase = createAuthenticatedClient(authHeader)
    } catch {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser()

    if (authError || !user) {
      console.error('[setup-credentials] Auth error:', authError?.message)
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
      .eq('user_id', user.id)
      .maybeSingle()

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[setup-credentials] Error fetching driver:', driverError)
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 })
    }

    if (!driver) {
      return NextResponse.json({ error: 'No driver record associated with this account' }, { status: 403 })
    }

    const { error: updateAuthError } = await userSupabase.auth.updateUser({
      email,
      password,
    })

    if (updateAuthError) {
      console.error('[setup-credentials] Failed to update auth user:', updateAuthError)
      const msg = updateAuthError.message?.toLowerCase().includes('already')
        ? 'Email address is already in use'
        : 'Failed to update credentials. Please try again.'
      return NextResponse.json({ error: msg }, { status: 409 })
    }

    const { data: updatedDriver, error: updateDriverError } = await admin
      .from('partner_drivers')
      .update({ email })
      .eq('id', (driver as { id: number }).id)
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
