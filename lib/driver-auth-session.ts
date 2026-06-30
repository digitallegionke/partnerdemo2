import { randomBytes } from 'crypto'
import { type SupabaseClient, type Session } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

/**
 * One-time password for Supabase Auth, generated only after OTP has verified the driver.
 * Never persisted, never sent to the client — only used server-side to obtain a session in the same request.
 */
export function generateEphemeralSupabaseAuthPassword(): string {
  return randomBytes(32).toString('base64url')
}

function isDuplicateUserError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = error.message?.toLowerCase() ?? ''
  return (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('already exists') ||
    error.code === 'user_already_exists'
  )
}

/**
 * Locate an existing auth user id by email using the Admin API.
 * Fallback for the rare case where the driver row was never linked (`user_id` is null)
 * but an orphaned auth user already exists for the email.
 */
async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase()
  const perPage = 1000
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) return null
    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < perPage) return null
  }
  return null
}

/**
 * After custom OTP proves identity: obtain a real Supabase session.
 *
 * New driver: anon `signUp` with a throwaway password creates the auth user and returns a session.
 *
 * Returning driver (auth user already exists for `@driver.internal`): we never stored their password,
 * so we use the service-role Admin API to set the same one-time password on the existing user, then
 * sign in with the anon client. The service role is used ONLY to mint this session — never for
 * tenant `public.*` data queries, which still run under the user's JWT (RLS enforced).
 */
export async function obtainDriverSessionAfterOtpVerified(options: {
  anon: SupabaseClient
  driverEmail: string
  fullName?: string
  /** The driver's linked auth user id (`drivers.user_id`), when already linked. */
  linkedAuthUserId?: string | null
}): Promise<{ accessToken: string; session: Session }> {
  const { anon, driverEmail, fullName, linkedAuthUserId } = options
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

  // New driver — signUp created the user and gave us a session.
  if (!signUp.error && signUp.data.session) {
    const session = signUp.data.session
    return { accessToken: session.access_token, session }
  }

  // A non-duplicate signUp failure is a real error.
  if (signUp.error && !isDuplicateUserError(signUp.error)) {
    throw new Error(signUp.error.message || 'signUp failed')
  }

  // Returning driver: the auth user already exists (duplicate error, or signUp returned no
  // session because the email is taken). Recover the session via the Admin API.
  const admin = createAdminClient()
  if (!admin) {
    throw new Error(
      'An account already exists for this driver, but the server is missing SUPABASE_SERVICE_ROLE_KEY to recover the session.'
    )
  }

  const userId = linkedAuthUserId || (await findAuthUserIdByEmail(admin, driverEmail))
  if (!userId) {
    throw new Error('Existing driver account could not be located for session recovery.')
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: {
      role: 'driver',
      ...(fullName ? { full_name: fullName } : {}),
    },
  })
  if (updateErr) {
    throw new Error(updateErr.message || 'Failed to prepare existing driver session')
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
