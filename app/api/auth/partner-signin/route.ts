import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Sign in with Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user || !data.session) {
      return NextResponse.json(
        { error: error?.message || "Authentication failed" },
        { status: 401 }
      )
    }

    // Verify the user is an active partner provider member
    const { data: membership, error: membershipError } = await supabase
      .from("partner_provider_users")
      .select("provider_id, role, is_active")
      .eq("user_id", data.user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied. This portal is for service provider accounts only." },
        { status: 403 }
      )
    }

    // Fetch the provider record for the response
    const { data: provider, error: providerError } = await supabase
      .from("partner_providers")
      .select("id, provider_name, status")
      .eq("id", membership.provider_id)
      .maybeSingle()

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Service provider profile not found" },
        { status: 403 }
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
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        provider: {
          id: provider.id,
          provider_name: provider.provider_name,
          status: provider.status,
          role: membership.role,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
