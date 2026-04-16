import { randomBytes } from 'crypto'
import { type SupabaseClient, type Session } from '@supabase/supabase-js'

/**
 * One-time password for Supabase Auth, generated only after OTP has verified the driver.
 * Never persisted, never sent to the client — only used server-side to obtain a session in the same request.
 *
 * This module uses only the **anon** Supabase client (same as the browser): no `SUPABASE_SERVICE_ROLE_KEY`,
 * so nothing here bypasses Postgres RLS on your `public.*` SaaS tables. RLS is enforced on all `.from()`
 * queries that use the user's JWT elsewhere; Auth Admin APIs are not used here.
 */
export function generateEphemeralSupabaseAuthPassword(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * After custom OTP proves identity: create a Supabase session using a throwaway password that exists only
 * for this request. Uses anon `signUp` + `signInWithPassword` only.
 *
 * If an auth user already exists for `@driver.internal` (e.g. partial failure, retry), we do **not** use
 * the service role to reset their password — that would require Auth Admin. The driver should use
 * password login or an admin-run recovery; SaaS tenants stay isolated via RLS on app data, not via
 * a global service key on this path.
 */
export async function obtainDriverSessionAfterOtpVerified(options: {
  anon: SupabaseClient
  driverEmail: string
  fullName?: string
  /** Unused — reserved for future flows that pass user id without Admin API */
  linkedAuthUserId?: string | null
}): Promise<{ accessToken: string; session: Session }> {
  const { anon, driverEmail, fullName } = options
  const password = generateEphemeralSupabaseAuthPassword()

  const signUp = await anon.auth.signUp({
    email: driverEmail,
    password,
    options: {
      data: {
        role: 'driver',
        full_name: fullName,
      },
    },
  })

  if (!signUp.error && signUp.data.session) {
    const session = signUp.data.session
    return { accessToken: session.access_token, session }
  }

  if (signUp.error) {
    const msg = signUp.error.message?.toLowerCase() ?? ''
    const duplicate =
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      signUp.error.code === 'user_already_exists'

    if (duplicate) {
      throw new Error(
        'An account already exists for this driver email. Use password login, or ask your administrator to reset access if you are setting up again.'
      )
    }

    throw new Error(signUp.error.message || 'signUp failed')
  }

  const signIn = await anon.auth.signInWithPassword({
    email: driverEmail,
    password,
  })

  if (signIn.error || !signIn.data.session) {
    throw new Error(signIn.error?.message || 'signInWithPassword failed after OTP verification')
  }

  const session = signIn.data.session
  return { accessToken: session.access_token, session }
}
