import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateKenyanPhone } from '@/lib/utils'

/**
 * POST /api/auth/signup
 * 
 * Purpose: Create a new user account via secure server-side endpoint
 * Keeps credentials server-side so API key is never exposed in client network requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email, password, full_name, phone } = body
    const requiredFields = ['email', 'password', 'full_name']
    const missingFields = requiredFields.filter(field => !body[field])

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Validate phone number if provided
    let normalizedPhone = null
    if (phone) {
      const phoneValidation = validateKenyanPhone(phone)
      if (!phoneValidation.valid) {
        return NextResponse.json(
          { error: phoneValidation.error || 'Invalid phone number format' },
          { status: 400 }
        )
      }
      normalizedPhone = phoneValidation.normalized
    }

    // Create server-side Supabase client with anon key (credentials handled server-side)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if phone number is already in use
    if (normalizedPhone) {
      const { data: existingPhoneUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .limit(1)

      if (existingPhoneUsers && existingPhoneUsers.length > 0) {
        return NextResponse.json(
          { error: 'This phone number is already registered' },
          { status: 400 }
        )
      }
    }

    // Sign up user - request is handled server-side, not exposed in client
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone: normalizedPhone || null,
        },
      },
    })

    if (error) {
      console.error('Error creating user:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Unexpected error in POST /api/auth/signup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
