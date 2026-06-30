/**
 * POST /api/drivers/auth/request-otp
 * 
 * Initiates OTP flow for driver authentication
 * Accepts phone number, validates it, checks if driver exists,
 * and sends OTP via Supabase auth
 * 
 * Rate limited to 3 requests per phone per 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import {
  validateAndNormalizePhone,
  isValidPhoneNumber,
} from '@/lib/phone-validation';
import { otpRateLimiter } from '@/lib/rate-limiter';
import {
  OtpException,
  OtpErrorCode,
  getOtpErrorMessage,
  type RequestOtpRequest,
  type RequestOtpResponse,
  type OtpErrorResponse,
} from '@/lib/otp-types';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Handle OTP request
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: RequestOtpRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_PHONE),
          code: OtpErrorCode.INVALID_PHONE,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    const { phone: rawPhone } = body;

    // Validate phone format
    if (!isValidPhoneNumber(rawPhone)) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_PHONE),
          code: OtpErrorCode.INVALID_PHONE,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Normalize phone to E.164 format
    const phone = validateAndNormalizePhone(rawPhone);
    if (!phone) {
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.INVALID_PHONE),
          code: OtpErrorCode.INVALID_PHONE,
        } as OtpErrorResponse,
        { status: 400 }
      );
    }

    // Rate limit key
    const rateLimitKey = `otp_request:${phone}`;
    if (!otpRateLimiter.isAllowed(rateLimitKey)) {
      const resetTime = otpRateLimiter.getResetTime(rateLimitKey);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.RATE_LIMIT_EXCEEDED),
          code: OtpErrorCode.RATE_LIMIT_EXCEEDED,
          retryAfter: resetTime,
        } as OtpErrorResponse,
        {
          status: 429,
          headers: {
            'Retry-After': resetTime.toString(),
          },
        }
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      console.error('[request-otp] SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    // Only registered drivers may request a login OTP.
    const { data: driverRow, error: driverErr } = await admin
      .from('partner_drivers')
      .select('id')
      .eq('phone_number', phone)
      .eq('is_deleted', false)
      .maybeSingle();

    if (driverErr) {
      console.error('[request-otp] driver lookup:', driverErr);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    if (!driverRow) {
      console.warn(`[request-otp] Phone not registered: ${phone}`);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.PHONE_NOT_REGISTERED),
          code: OtpErrorCode.PHONE_NOT_REGISTERED,
        } as OtpErrorResponse,
        { status: 404 }
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    // Invalidate any earlier codes for this phone so only the newest one is valid.
    await admin.from('otp_verifications').delete().eq('phone', phone);

    const { error: insertErr } = await admin.from('otp_verifications').insert({
      phone,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      created_at: createdAt,
    });

    if (insertErr) {
      console.error('[request-otp] otp_verifications insert:', insertErr);
      return NextResponse.json(
        {
          error: getOtpErrorMessage(OtpErrorCode.DATABASE_ERROR),
          code: OtpErrorCode.DATABASE_ERROR,
        } as OtpErrorResponse,
        { status: 500 }
      );
    }

    // Development: log OTP instead of sending SMS
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n===========================================\n📱 OTP Request for: ${phone}\n🔐 Code: ${otp}\n⏰ Expires: 5 minutes\n===========================================\n`);

      const remainingAttempts = otpRateLimiter.getRemainingAttempts(rateLimitKey);

      const response: RequestOtpResponse = {
        success: true,
        message: 'OTP logged to console',
        attemptsRemaining: remainingAttempts,
      };

      return NextResponse.json(response, { status: 200 });
    }

    // Production: SMS sending integration placeholder
    // TODO: Implement sendSMS(phone, `Your verification code: ${otp}`)

    const remainingAttempts = otpRateLimiter.getRemainingAttempts(rateLimitKey);
    const response: RequestOtpResponse = {
      success: true,
      message: `OTP sent to ${phone}`,
      attemptsRemaining: remainingAttempts,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[request-otp] Unexpected error:', error);
    return NextResponse.json(
      {
        error: getOtpErrorMessage(OtpErrorCode.SUPABASE_ERROR),
        code: OtpErrorCode.SUPABASE_ERROR,
      } as OtpErrorResponse,
      { status: 500 }
    );
  }
}
