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

    // Use service role client for all admin operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if a provider with this email already exists
    const { data: existingProvider } = await adminClient
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

    // Step 1: Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: contactPerson,
        phone: phoneNumber,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Step 2: Create partner_providers record
    const { data: provider, error: providerError } = await adminClient
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
      // Clean up auth user to avoid orphans
      await adminClient.auth.admin.deleteUser(userId)
      console.error('Error creating partner provider:', providerError)
      return NextResponse.json(
        { error: providerError?.message || 'Failed to create service provider' },
        { status: 500 }
      )
    }

    // Step 3: Create partner_provider_users record
    const { error: memberError } = await adminClient
      .from('partner_provider_users')
      .insert({
        provider_id: provider.id,
        user_id: userId,
        role: 'owner',
        is_primary: true,
        is_active: true,
      })

    if (memberError) {
      // Clean up provider and auth user
      await adminClient.from('partner_providers').delete().eq('id', provider.id)
      await adminClient.auth.admin.deleteUser(userId)
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
