/**
 * POST /api/invites
 *
 * Creates a team invite with a cryptographically secure token,
 * stores it in the database, and sends the invite email.
 *
 * Requires authentication (must be org owner).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'
import { getSupabaseServer } from '@/lib/supabase-server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an org owner
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owners can send invites' }, { status: 403 })
    }

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organization')
      .select('id, company_name')
      .eq('user', user.id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Parse request body
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Generate cryptographically secure token
    const inviteToken = crypto.randomBytes(32).toString('hex')

    // Use admin client for insert (bypasses RLS)
    const adminClient = await getSupabaseServer()

    // Check if invite already exists for this email + org
    const { data: existingInvite } = await adminClient
      .from('invites')
      .select('id, used')
      .eq('email', email)
      .eq('organization_id', org.id)
      .eq('used', false)
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An active invite already exists for this email' },
        { status: 409 }
      )
    }

    // Insert invite record
    const { error: insertError } = await adminClient.from('invites').insert([
      {
        email,
        invite_token: inviteToken,
        used: false,
        invited_by: user.id,
        organization_id: org.id,
      },
    ])

    if (insertError) {
      console.error('Error inserting invite:', insertError)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Build invite link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}`

    // Send invite email if Resend is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'invites@roundi.africa',
          to: [email],
          subject: `You're invited to join ${org.company_name} on Roundi`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333; text-align: center;">You're Invited!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                You've been invited to join <strong>${org.company_name}</strong> on Roundi.
                Click the button below to accept your invitation and get started.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}"
                   style="background-color: #162318; color: #C8E298; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #999; font-size: 14px; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #007bff;">${inviteLink}</a>
              </p>
              <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
                This invitation will expire in 7 days.
              </p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Error sending invite email:', emailErr)
        // Don't fail the request - invite was created successfully
      }
    } else {
      console.log(`[invites] Email service not configured. Invite link: ${inviteLink}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Invite sent successfully',
      inviteLink,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/invites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
