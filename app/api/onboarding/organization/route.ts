import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * POST /api/onboarding/organization
 *
 * Purpose: Proxy organization onboarding inserts through the server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const {
      organizationName,
      contactEmail,
      contactPhone,
      address,
      website,
      ordersPerDay,
      teamSize,
      driversCount,
      yearsInBusiness,
      industry,
      operatingHours,
      operatingDays,
      primaryDeliveryArea,
      deliveryChallenge,
      desiredFeatures,
      termsAccepted,
    } = body

    const required = [
      'organizationName',
      'contactEmail',
      'contactPhone',
      'industry',
      'yearsInBusiness',
      'operatingHours',
      'operatingDays',
      'ordersPerDay',
      'teamSize',
      'driversCount',
      'primaryDeliveryArea',
      'termsAccepted',
    ]

    const missing = required.filter((k) => !body[k])
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    // Ensure user is authenticated server-side
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    // Insert into organization table
    const { error: orgError } = await supabase.from('organization').insert({
      company_name: organizationName,
      industry,
      company_email: contactEmail,
      company_phone: contactPhone,
      headquarters: address || null,
      operating_hours: operatingHours || null,
      operating_days: operatingDays || null,
      accepted_terms: !!termsAccepted,
      company_website: website || null,
      user: user.id,
    })

    if (orgError) {
      console.error('Organization insert error:', orgError)
      return NextResponse.json({ error: orgError.message || 'Failed to create organization' }, { status: 500 })
    }

    // Insert into business_profiles
    const { error: bpError } = await supabase.from('business_profiles').insert([
      {
        orders_per_day: ordersPerDay || null,
        team_size: teamSize || null,
        drivers_count: driversCount || null,
        years_in_business: yearsInBusiness || null,
        primary_delivery_area: primaryDeliveryArea || null,
        delivery_challenge: Array.isArray(deliveryChallenge) ? deliveryChallenge.join(', ') : (deliveryChallenge || null),
        features_wishlist: desiredFeatures || null,
        user_id: user.id,
      },
    ])

    if (bpError) {
      console.error('Business profile insert error:', bpError)
      return NextResponse.json({ error: bpError.message || 'Failed to create business profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Organization onboarded' }, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error in onboarding route:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
