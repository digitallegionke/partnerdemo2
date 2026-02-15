/**
 * POST /api/drivers/auth/verify-setup-otp
 *
 * Verifies the one-time setup OTP assigned when a driver is created.
 * This OTP is meant to be used ONCE for the driver's initial login in the Expo app.
 *
 * After successful verification:
 * - Marks the setup OTP as used
 * - Updates phone_verified_at
 * - Creates and returns a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { validateAndNormalizePhone } from '@/lib/phone-validation';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface VerifySetupOtpRequest {
  phone: string;
  otp: string;
}

interface VerifySetupOtpResponse {
  success: boolean;
  message: string;
  session?: any;
  driver?: any;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// Dummy hash for timing attack mitigation
const DUMMY_HASH = '$2b$10$zQeY5H0H0xDqK2y6Gg3yMeqXfV9f8hG1lW7mGq5N9fQ0eV8r3X9Qe';

export async function POST(req: NextRequest): Promise<NextResponse<VerifySetupOtpResponse | ErrorResponse>> {
  try {
    // Parse request body
    let body: VerifySetupOtpRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { phone: rawPhone, otp } = body;

    // Validate inputs
    if (!rawPhone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Normalize phone to E.164 format
    const phone = validateAndNormalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    console.log('[verify-setup-otp] Verifying setup OTP for phone:', phone);

    // Use service-role Supabase client
    const adminSupabase = await getSupabaseServer();

    // Fetch driver by phone
    const { data: driver, error: driverError } = await adminSupabase
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[verify-setup-otp] Database error:', driverError);
      return NextResponse.json(
        { error: 'Database error. Please try again later.' },
        { status: 500 }
      );
    }

    if (!driver) {
      // Dummy compare to mitigate timing attacks
      await bcrypt.compare(otp, DUMMY_HASH);
      return NextResponse.json(
        { error: 'No driver found with this phone number' },
        { status: 404 }
      );
    }

    const driverAny = driver as any;

    // Check if setup OTP exists
    if (!driverAny.setup_otp_hash) {
      return NextResponse.json(
        { error: 'No setup OTP found for this driver. Please contact your administrator.' },
        { status: 400 }
      );
    }

    // Check if setup OTP has already been used
    if (driverAny.setup_otp_used) {
      return NextResponse.json(
        { error: 'Setup OTP has already been used. Please use the regular OTP login or contact your administrator.' },
        { status: 400 }
      );
    }

    // Check if setup OTP has expired
    if (driverAny.setup_otp_expires_at && new Date(driverAny.setup_otp_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Setup OTP has expired. Please contact your administrator for a new one.' },
        { status: 400 }
      );
    }

    // Verify the OTP
    const isValid = await bcrypt.compare(otp, driverAny.setup_otp_hash);

    if (!isValid) {
      console.log('[verify-setup-otp] Invalid setup OTP provided');
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      );
    }

    console.log('[verify-setup-otp] Setup OTP verified successfully');

    // Mark setup OTP as used and update phone_verified_at
    const updates: any = {
      setup_otp_used: true,
      phone_verified_at: new Date().toISOString(),
    };

    // Activate driver if in pending state
    if (driverAny.status === 'pending_activation') {
      updates.status = 'active';
    }

    const { data: updatedDriver, error: updateError } = await (adminSupabase as any)
      .from('drivers')
      .update(updates)
      .eq('id', driverAny.id)
      .select()
      .single();

    if (updateError) {
      console.error('[verify-setup-otp] Error updating driver:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete verification. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[verify-setup-otp] Driver updated successfully');

    // Create session for the driver
    let session = null;
    try {
      console.log('[verify-setup-otp] Creating session...');

      // Generate temporary password
      const tempPassword = crypto.randomBytes(32).toString('hex');

      // Get email for this driver
      const driverEmail = `${phone.replace('+', '')}@driver.internal`;

      // Get or verify auth user exists
      const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
      let authUser = (authUsers?.users || []).find((u: any) =>
        u.phone === phone || u.email === driverEmail
      );

      if (!authUser && driverAny.user_id) {
        // Try to get user by ID
        const { data: userById } = await adminSupabase.auth.admin.getUserById(driverAny.user_id);
        authUser = userById?.user ?? undefined;
      }

      if (!authUser) {
        console.error('[verify-setup-otp] No auth user found for driver');
        return NextResponse.json({
          success: true,
          message: 'OTP verified but session creation failed. Please try regular login.',
          driver: updatedDriver,
        }, { status: 200 });
      }

      // Update auth user with temporary password
      const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(
        authUser.id,
        {
          password: tempPassword,
          email: driverEmail,
          email_confirm: true,
        }
      );

      if (updateAuthError) {
        console.error('[verify-setup-otp] Failed to update auth user:', updateAuthError);
        throw updateAuthError;
      }

      // Sign in with email and temporary password to get session
      const { data: signInData, error: signInError } = await adminSupabase.auth.signInWithPassword({
        email: driverEmail,
        password: tempPassword,
      });

      if (signInError) {
        console.error('[verify-setup-otp] Failed to sign in:', signInError);
        throw signInError;
      }

      if (signInData?.session) {
        session = signInData.session;
        console.log('[verify-setup-otp] Session created successfully');
      }
    } catch (err) {
      console.error('[verify-setup-otp] Error creating session:', err);
      // Don't fail the entire request - driver is verified, just no session
    }

    const response: VerifySetupOtpResponse = {
      success: true,
      message: session ? 'Setup OTP verified successfully. Welcome!' : 'Setup OTP verified, but session creation failed.',
      session: session,
      driver: updatedDriver,
    };

    console.log('[verify-setup-otp] Returning response with session:', !!session);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[verify-setup-otp] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
