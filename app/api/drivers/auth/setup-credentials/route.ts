/**
 * POST /api/drivers/auth/setup-credentials
 *
 * Allows an authenticated driver to set up a permanent email and password.
 * Requires a valid Bearer session token (obtained via OTP login or setup OTP).
 *
 * Body: { email: string, password: string }
 *   - email: the driver's real email address to associate with their account
 *   - password: the password they want to use for future logins
 *
 * Response: { driver }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase-server';

interface SetupCredentialsRequest {
  email: string;
  password: string;
}

interface SetupCredentialsResponse {
  driver: any;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(
  req: NextRequest
): Promise<NextResponse<SetupCredentialsResponse | ErrorResponse>> {
  try {
    // Authenticate the driver from the Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    let userSupabase: ReturnType<typeof createAuthenticatedClient>;
    try {
      userSupabase = createAuthenticatedClient(authHeader);
    } catch {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error('[setup-credentials] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    console.log('[setup-credentials] Authenticated user:', user.id);

    // Parse and validate body
    let body: SetupCredentialsRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Prevent using an internal driver email as a real email
    if (email.endsWith('@driver.internal')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const adminSupabase = await getSupabaseServer();

    // Ensure this auth user is actually a driver
    const { data: driver, error: driverError } = await adminSupabase
      .from('drivers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[setup-credentials] Error fetching driver:', driverError);
      return NextResponse.json({ error: 'Failed to fetch driver record' }, { status: 500 });
    }

    if (!driver) {
      return NextResponse.json({ error: 'No driver record associated with this account' }, { status: 403 });
    }

    console.log('[setup-credentials] Driver found:', (driver as any).id);

    // Check that the new email is not already taken by another auth user
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const emailTaken = (existingUsers?.users || []).some(
      (u) => u.email === email && u.id !== user.id
    );
    if (emailTaken) {
      return NextResponse.json({ error: 'Email address is already in use' }, { status: 409 });
    }

    // Update the auth user with the real email and new password
    const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true, // Skip confirmation email — driver already authenticated via OTP
      password,
    });

    if (updateAuthError) {
      console.error('[setup-credentials] Failed to update auth user:', updateAuthError);
      return NextResponse.json(
        { error: 'Failed to update credentials. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[setup-credentials] Auth user credentials updated');

    // Update driver record with the real email
    const { data: updatedDriver, error: updateDriverError } = await (adminSupabase as any)
      .from('drivers')
      .update({ email })
      .eq('id', (driver as any).id)
      .select()
      .single();

    if (updateDriverError) {
      console.error('[setup-credentials] Failed to update driver email:', updateDriverError);
      // Non-fatal: auth credentials are already updated; return the original driver
      return NextResponse.json({ driver }, { status: 200 });
    }

    console.log('[setup-credentials] Driver credentials set up successfully');

    return NextResponse.json({ driver: updatedDriver }, { status: 200 });
  } catch (error: any) {
    console.error('[setup-credentials] Unexpected error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
