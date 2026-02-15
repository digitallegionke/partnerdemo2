/**
 * POST /api/drivers/auth/verify-otp
 * 
 * Verifies OTP code and completes driver authentication
 * - Verifies OTP with database
 * - Checks user has 'driver' role
 * - Links driver record to auth user
 * - Updates phone_verified_at on first verification
 * - Activates driver on first login (pending_activation -> active)
 * - Creates and returns session
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
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

    console.log('[verify-otp] Verifying OTP for phone:', phone);

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

    // Cast verification to any to avoid strict DB typings
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
      console.log('[verify-otp] Invalid OTP provided');
      // Increment attempts
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

    console.log('[verify-otp] OTP verified successfully');

    // Valid OTP - delete verification record (one-time use)
    const { error: delErr } = await (adminSupabase as any)
      .from('otp_verifications')
      .delete()
      .eq('id', verificationAny.id);
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

    console.log('[verify-otp] Driver found:', (driver as any).id);

    // Use typed any for driver
    const driverAny: any = driver;

    const isFirstLogin = !driverAny.user_id;
    const isFirstPhoneVerification = !driverAny.phone_verified_at;

    // Try to find auth user by phone
    // Try to find auth user by phone OR email
const { data: authUsers, error: listErr } = await adminSupabase.auth.admin.listUsers();
if (listErr) console.error('[verify-otp] Error listing auth users:', listErr);

const driverEmail = `${phone.replace('+', '')}@driver.internal`;

// Search by both phone and email
let authUser = (authUsers?.users || []).find((u: any) =>
  u.phone === phone || u.email === driverEmail
);

console.log('[verify-otp] Auth user search:', {
  searchingForPhone: phone,
  searchingForEmail: driverEmail,
  foundUser: !!authUser,
  userId: authUser?.id,
});

    // If no auth user found, create one
    if (!authUser) {
      console.log('[verify-otp] No auth user found, creating one...');
      
      const driverEmail = `${phone.replace('+', '')}@driver.internal`;
      
      const { data: newAuthUserData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
        phone: phone,
        email: driverEmail,
        email_confirm: true,
        phone_confirm: true, // Already verified via OTP
        user_metadata: {
          role: 'driver',
          full_name: driverAny.name,
        },
      });

      if (createAuthError) {
        console.error('[verify-otp] Failed to create auth user:', createAuthError);
        return NextResponse.json(
          {
            error: 'Failed to create authentication user',
            code: OtpErrorCode.SUPABASE_ERROR,
          } as OtpErrorResponse,
          { status: 500 }
        );
      }

      authUser = newAuthUserData.user;
      console.log('[verify-otp] Auth user created:', authUser.id);
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

    console.log('[verify-otp] Driver updated successfully');

    // Fetch organization name server-side (service role bypasses RLS)
    let organization_name: string | null = null;
    const orgId = (updatedDriver as any)?.org_id;
    if (orgId) {
      const { data: orgData } = await (adminSupabase as any)
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle();
      organization_name = orgData?.name ?? null;
    }
    console.log('[verify-otp] Organization name:', organization_name);

    // Create session using temporary password method
    let session = null;
    try {
      console.log('[verify-otp] Creating session...');
      
      // Generate temporary password
      const tempPassword = crypto.randomBytes(32).toString('hex');
      
      // Get/create email for this user
      const driverEmail = `${phone.replace('+', '')}@driver.internal`;
      
      // Update auth user with temporary password, email, and org name in metadata
      const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(
        authUser.id,
        {
          password: tempPassword,
          email: driverEmail,
          email_confirm: true,
          user_metadata: {
            role: 'driver',
            full_name: driverAny.name,
            org_name: organization_name,
          },
        }
      );

      if (updateAuthError) {
        console.error('[verify-otp] Failed to update auth user:', updateAuthError);
        throw updateAuthError;
      }

      console.log('[verify-otp] Auth user updated with temp password');

      // Sign in with email and temporary password to get session
      const { data: signInData, error: signInError } = await adminSupabase.auth.signInWithPassword({
        email: driverEmail,
        password: tempPassword,
      });

      if (signInError) {
        console.error('[verify-otp] Failed to sign in:', signInError);
        throw signInError;
      }

      if (signInData?.session) {
        session = signInData.session;
        console.log('[verify-otp] Session created successfully');
      }
    } catch (err) {
      console.error('[verify-otp] Error creating session:', err);
      // Don't fail the entire request - user is authenticated, just no session
    }

    const response: VerifyOtpResponse = {
      success: true,
      message: session ? 'OTP verified successfully' : 'OTP verified, session creation failed',
      session: session as any,
      driver: updatedDriver,
      isFirstLogin,
      organization_name: organization_name ?? undefined,
    };

    console.log('[verify-otp] Returning response with session:', !!session);

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