import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { email, inviteLink } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }


     // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: process.env.FROM_EMAIL || "invites@roundi.africa",
      to: [email],
      subject: "You're invited!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">You're Invited!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            You've been invited to join our platform. Click the button below to accept your invitation and get started.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
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
    });

    if (emailError) {
      console.error("Email error:", emailError)
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Invite sent successfully" })
  } catch (error) {
    console.error("Error sending invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
