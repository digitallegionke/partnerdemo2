import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { businessName, contactPerson, email, phoneNumber, serviceMode, password } = body

    // Validate required fields
    const required = ['businessName', 'contactPerson', 'email', 'phoneNumber', 'serviceMode', 'password']
    const missing = required.filter((k) => !body[k])
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const validServiceModes = ['allocation', 'managed_delivery', 'both']
    if (!validServiceModes.includes(serviceMode)) {
      return NextResponse.json(
        { error: 'Invalid service mode. Must be one of: allocation, managed_delivery, both' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check for duplicate email before creating auth user
    const { data: existingProvider } = await supabase
      .from('partner_providers')
      .select('id')
      .eq('contact_email', email)
      .maybeSingle()

    if (existingProvider) {
      return NextResponse.json(
        { error: 'A service provider with this email already exists' },
        { status: 409 }
      )
    }

    // Step 1: Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: contactPerson, phone: phoneNumber },
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Build an authenticated client using the session returned by signUp.
    // If email confirmation is enabled in Supabase, session will be null and
    // the inserts will run under the anon role — your RLS policies must allow this.
    const authedClient = authData.session
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: { autoRefreshToken: false, persistSession: false },
            global: {
              headers: { Authorization: `Bearer ${authData.session.access_token}` },
            },
          }
        )
      : supabase

    // Step 2: Create the partner_providers record
    const { data: provider, error: providerError } = await authedClient
      .from('partner_providers')
      .insert({
        provider_name: businessName,
        contact_email: email,
        contact_phone: phoneNumber,
        service_mode: serviceMode,
        status: 'pending',
        onboarding_completed: false,
        created_by: userId,
      })
      .select('id, provider_name, status')
      .single()

    if (providerError || !provider) {
      console.error('Error creating partner provider:', providerError)
      return NextResponse.json(
        { error: providerError?.message || 'Failed to create service provider' },
        { status: 500 }
      )
    }

    // Step 3: Link the user to the provider as owner
    const { error: memberError } = await authedClient
      .from('partner_provider_users')
      .insert({
        provider_id: provider.id,
        user_id: userId,
        role: 'owner',
        is_primary: true,
        is_active: true,
      })

    if (memberError) {
      console.error('Error creating provider user membership:', memberError)
      return NextResponse.json(
        { error: 'Failed to link user to service provider' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Service provider registered successfully',
        provider: {
          id: provider.id,
          provider_name: provider.provider_name,
          status: provider.status,
        },
        user: {
          id: userId,
          email: authData.user.email,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Unexpected error in POST /api/partner-providers/register:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
