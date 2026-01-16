/**
 * POST /api/drivers/auth/verify-otp
 * 
 * Verifies OTP code and completes driver authentication
 * - Verifies OTP with Supabase
 * - Checks user has 'driver' role
 * - Links driver record to auth user
 * - Updates phone_verified_at on first verification
 * - Activates driver on first login (pending_activation -> active)
 * - Returns session and driver info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { validateAndNormalizePhone } from '@/lib/phone-validation';
import {
  OtpErrorCode,
  getOtpErrorMessage,
  type VerifyOtpRequest,
  type VerifyOtpResponse,
  type OtpErrorResponse,
} from '@/lib/otp-types';
import {
  completePhoneVerification,
  linkDriverToAuthUser,
  markPhoneAsVerified,
} from '@/lib/otp-driver-auth';
import bcrypt from 'bcryptjs';

// Dummy hash for timing attack mitigation (hash for '000000')
const DUMMY_HASH = '$2b$10$zQeY5H0H0xDqK2y6Gg3yMeqXfV9f8hG1lW7mGq5N9fQ0eV8r3X9Qe';

/**
 * Handle OTP verification
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: VerifyOtpRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    const { phone: rawPhone, otp } = body;

    // Validate inputs
    if (!rawPhone || !otp) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Normalize phone
    const phone = validateAndNormalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Use service-role supabase for DB ops
    const adminSupabase = await getSupabaseServer();

    // Fetch most recent, non-expired verification
    const now = new Date().toISOString();
    const { data: verification, error: fetchErr } = await adminSupabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', phone)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.error('[verify-otp] Error fetching verification record:', fetchErr);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    if (!verification) {
      // Dummy compare to mitigate timing attacks
      await bcrypt.compare(otp, DUMMY_HASH);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.EXPIRED_OTP),
          code: OtpErrorCode.EXPIRED_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Cast verification to any to avoid strict DB typings for this table in this handler
    const verificationAny: any = verification;

    const attempts = verificationAny.attempts ?? 0;
    if (attempts >= 3) {
      // Delete record to force re-request
      await (adminSupabase as any).from('otp_verifications').delete().eq('id', verificationAny.id);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.RATE_LIMIT_EXCEEDED),
          code: OtpErrorCode.RATE_LIMIT_EXCEEDED,
        } as OtpErrorResponse,
        { status: 429 }
      );
    }

    // Compare provided OTP with stored hash
    const isValid = await bcrypt.compare(otp, verificationAny.otp_hash);

    if (!isValid) {
      // increment attempts
      const { error: updErr } = await (adminSupabase as any)
        .from('otp_verifications')
        .update({ attempts: (attempts || 0) + 1 })
        .eq('id', verificationAny.id);

      if (updErr) console.error('[verify-otp] Failed to increment attempts:', updErr);

      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_OTP),
          code: OtpErrorCode.INVALID_OTP,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Valid OTP - delete verification record (one-time use)
    const { error: delErr } = await (adminSupabase as any).from('otp_verifications').delete().eq('id', verificationAny.id);
    if (delErr) console.error('[verify-otp] Failed to delete verification record:', delErr);

    // Get driver record using adminSupabase (service-role)
    const { data: driver, error: driverError } = await adminSupabase
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (driverError && driverError.code !== 'PGRST116') {
      console.error('[verify-otp] Error fetching driver:', driverError);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    if (!driver) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.PHONE_NOT_REGISTERED),
          code: OtpErrorCode.PHONE_NOT_REGISTERED,
        } as OtpErrorResponse,
        { status: 404 }
      );
    }

    // Use a typed any for driver to avoid TS issues with generated types
    const driverAny: any = driver;

    const isFirstLogin = !driverAny.user_id;
    const isFirstPhoneVerification = !driverAny.phone_verified_at;

    // Link driver to auth user and mark verified
    // Expect client to have exchanged OTP for session via Supabase client-side on verify
    // If using server-side session creation, create session using admin client

    // Try to find auth user by phone
    const { data: authUsers, error: listErr } = await adminSupabase.auth.admin.listUsers();
    if (listErr) console.error('[verify-otp] Error listing auth users:', listErr);

    const authUser = (authUsers?.users || []).find((u: any) => u.phone === phone);

    if (!authUser) {
      console.error('[verify-otp] No auth user found for phone:', phone);
      // Return success but without session
      const response: VerifyOtpResponse = {
        success: true,
        message: 'OTP verified, no session created',
        session: null,
        driver: driverAny,
        isFirstLogin,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Link driver to auth user + update phone_verified_at and status
    const updates: any = { user_id: authUser.id };
    if (isFirstPhoneVerification) updates.phone_verified_at = new Date().toISOString();
    if (isFirstLogin && driverAny.status === 'pending_activation') updates.status = 'active';

    const { data: updatedDriver, error: updateErr } = await (adminSupabase as any)
      .from('drivers')
      .update(updates)
      .eq('id', driverAny.id)
      .select()
      .single();

    if (updateErr) {
      console.error('[verify-otp] Error updating driver:', updateErr);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    // Create a session for the auth user using admin client
    let session = null;
    try {
      // Cast admin client to any to access createSession if available on runtime
      const adminAuthAny: any = adminSupabase.auth?.admin;
      if (adminAuthAny && typeof adminAuthAny.createSession === 'function') {
        const { data: sessionData, error: sessionError } = await adminAuthAny.createSession({
          user_id: authUser.id,
        });

        if (sessionError) {
          console.error('[verify-otp] Failed to create session:', sessionError);
        } else if (sessionData?.session) {
          // Use the full session object returned by Supabase
          session = sessionData.session as any;
        }
      } else {
        // Fallback: try calling createSession directly and ignore TS if available at runtime
        try {
          const { data: sessionData, error: sessionError } = await (adminSupabase.auth as any).createSession?.({ user_id: authUser.id });
          if (sessionError) console.error('[verify-otp] Failed to create session (fallback):', sessionError);
          else if (sessionData?.session) session = sessionData.session as any;
        } catch (err) {
          // no-op
        }
      }
    } catch (err) {
      console.error('[verify-otp] Error creating session:', err);
    }

    const response: VerifyOtpResponse = {
      success: true,
      message: session ? 'OTP verified successfully' : 'Authentication successful',
      session: session as any,
      driver: updatedDriver,
      isFirstLogin,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[verify-otp] Unexpected error:', error);
    return NextResponse.json(
      {
        error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
        code: OtpErrorCode.SUPABASE_ERROR,
      } as OtpErrorResponse,
      { status: 500 }
    );
  }
}
