/**
 * POST /api/drivers/[id]/regenerate-otp
 *
 * Regenerates the one-time setup OTP for an existing partner driver.
 * Use this when:
 * - The original OTP has expired
 * - The driver lost their OTP
 * - Admin needs to re-share the setup code
 *
 * Requires authentication; scoped to the caller's provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Generate a secure 6-digit setup OTP
 */
function generateSetupOtp(): { otp: string; hash: string; expiresAt: string } {
  const otp = crypto.randomInt(100000, 999999).toString();
  const hash = bcrypt.hashSync(otp, 10);
  // Setup OTP expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { otp, hash, expiresAt };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const driverId = parseInt(id, 10);

    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authenticate the user making the request
    const supabase = createAuthenticatedClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the caller's provider
    const { data: membership, error: membershipError } = await supabase
      .from('partner_provider_users')
      .select('provider_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No provider found for this user' }, { status: 403 });
    }

    const providerId = (membership as { provider_id: number }).provider_id;

    const { data: driver, error: driverError } = await supabase
      .from('partner_drivers')
      .select('id')
      .eq('id', driverId)
      .eq('provider_id', providerId)
      .maybeSingle();

    if (driverError) {
      console.error('Error fetching driver:', driverError);
      return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 });
    }

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Generate new setup OTP
    const setupOtpData = generateSetupOtp();
    console.log(`[regenerate-otp] Generated new setup OTP for partner driver ${driverId}`);

    // Update driver with new OTP
    const { data: updatedDriver, error: updateError } = await supabase
      .from('partner_drivers')
      .update({
        setup_otp_hash: setupOtpData.hash,
        setup_otp_expires_at: setupOtpData.expiresAt,
        setup_otp_used: false,
      })
      .eq('id', driverId)
      .eq('provider_id', providerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating driver with new OTP:', updateError);
      return NextResponse.json({ error: 'Failed to regenerate OTP' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      driver: updatedDriver,
      setupOtp: setupOtpData.otp,
      expiresAt: setupOtpData.expiresAt,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in POST /api/drivers/[id]/regenerate-otp:', error?.message ?? error);
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
  }
}
