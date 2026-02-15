/**
 * POST /api/drivers/auth/login
 *
 * Authenticates a driver using email/phone identifier and password.
 * Returns the driver record and a Supabase session.
 *
 * Body: { identifier: string, password: string }
 *   - identifier: driver's email or phone number (E.164 format)
 *   - password: driver's password (set via /api/drivers/auth/setup-credentials)
 *
 * Response: { driver, session }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { validateAndNormalizePhone } from '@/lib/phone-validation';

interface LoginRequest {
  identifier: string;
  password: string;
}

interface LoginResponse {
  driver: any;
  session: any;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

function isPhoneNumber(value: string): boolean {
  // Matches E.164-style phone numbers or common phone patterns
  return /^\+?[0-9\s\-().]{7,20}$/.test(value) && !/[@]/.test(value);
}

export async function POST(req: NextRequest): Promise<NextResponse<LoginResponse | ErrorResponse>> {
  try {
    let body: LoginRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'identifier and password are required' },
        { status: 400 }
      );
    }

    // Resolve the email to sign in with
    let email: string;

    if (isPhoneNumber(identifier)) {
      const phone = validateAndNormalizePhone(identifier);
      if (!phone) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
      // Drivers without a custom email use this internal format
      email = `${phone.replace('+', '')}@driver.internal`;
      console.log('[driver-login] Phone login, using internal email:', email);
    } else {
      email = identifier.trim().toLowerCase();
      console.log('[driver-login] Email login:', email);
    }

    const adminSupabase = await getSupabaseServer();

    // Sign in via Supabase Auth
    const { data: signInData, error: signInError } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      console.error('[driver-login] Sign-in failed:', signInError?.message);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const authUserId = signInData.session.user.id;
    console.log('[driver-login] Auth user authenticated:', authUserId);

    // Fetch associated driver record
    const { data: driver, error: driverError } = await adminSupabase
      .from('drivers')
      .select('*')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[driver-login] Error fetching driver:', driverError);
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 });
    }

    if (!driver) {
      console.error('[driver-login] No driver record for auth user:', authUserId);
      return NextResponse.json({ error: 'No driver found for these credentials' }, { status: 404 });
    }

    console.log('[driver-login] Driver login successful:', (driver as any).id);

    return NextResponse.json(
      { driver, session: signInData.session },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[driver-login] Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
