/**
 * POST /api/drivers/[id]/regenerate-otp
 *
 * Regenerates the one-time setup OTP for an existing driver.
 * Use this when:
 * - The original OTP has expired
 * - The driver lost their OTP
 * - Admin needs to re-share the setup code
 *
 * Requires admin authentication.
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

    // Authenticate the admin making the request
    const supabase = createAuthenticatedClient(request.headers.get('authorization'));
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization membership
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found for this user' }, { status: 403 });
    }

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .eq('org_id', membership.organization_id)
      .maybeSingle();

    if (driverError) {
      console.error('Error fetching driver:', driverError);
      return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 });
    }

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const driverAny = driver as any;

    // Check if the driver has already used their setup OTP
    if (driverAny.setup_otp_used && driverAny.phone_verified_at) {
      return NextResponse.json({
        error: 'This driver has already completed setup. They can use the regular OTP login flow.',
      }, { status: 400 });
    }

    // Generate new setup OTP
    const setupOtpData = generateSetupOtp();
    console.log(`[regenerate-otp] Generated new setup OTP for driver ${driverId}`);

    // Update driver with new OTP
    const { data: updatedDriver, error: updateError } = await supabase
      .from('drivers')
      .update({
        setup_otp_hash: setupOtpData.hash,
        setup_otp_expires_at: setupOtpData.expiresAt,
        setup_otp_used: false,
      })
      .eq('id', driverId)
      .eq('org_id', membership.organization_id)
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
    console.error('Unexpected error in POST /api/drivers/[id]/regenerate-otp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
