import { randomBytes, randomUUID } from 'crypto'

/**
 * DEMO-MODE STORE.
 *
 * Stands in for `partner_drivers.{user_id,phone_verified_at,setup_otp_*}` and
 * real Supabase Auth sessions, neither of which are provisioned in this
 * environment (the columns don't exist yet; SUPABASE_SERVICE_ROLE_KEY is used
 * only to read/write the real driver row, not to mint Auth users). State is
 * process-memory only — it resets on server restart and isn't shared across
 * instances. Replace with the real columns + Supabase Auth once the
 * `partner_drivers` migration lands; see the ALTER TABLE noted in the OTP
 * feature's PR description.
 */

interface DemoAuthState {
  userId: string
  phoneVerifiedAt: string | null
  setupOtpHash: string | null
  setupOtpExpiresAt: string | null
  setupOtpUsed: boolean
  passwordHash: string | null
}

interface DemoSession {
  driverId: number
  expiresAt: number
}

interface DemoSessionPayload {
  access_token: string
  refresh_token: string
  token_type: string
  expires_at: number
  expires_in: number
  user: { id: string; email: string; role: string }
}

const authState = new Map<number, DemoAuthState>()
const sessions = new Map<string, DemoSession>()

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function defaultState(): DemoAuthState {
  return {
    userId: `demo-user-${randomUUID()}`,
    phoneVerifiedAt: null,
    setupOtpHash: null,
    setupOtpExpiresAt: null,
    setupOtpUsed: false,
    passwordHash: null,
  }
}

export function getDemoAuthState(driverId: number): DemoAuthState {
  let state = authState.get(driverId)
  if (!state) {
    state = defaultState()
    authState.set(driverId, state)
  }
  return state
}

export function setDemoSetupOtp(driverId: number, hash: string, expiresAt: string): void {
  const state = getDemoAuthState(driverId)
  state.setupOtpHash = hash
  state.setupOtpExpiresAt = expiresAt
  state.setupOtpUsed = false
}

export function markDemoSetupOtpUsed(driverId: number): void {
  getDemoAuthState(driverId).setupOtpUsed = true
}

export function markDemoPhoneVerified(driverId: number): void {
  getDemoAuthState(driverId).phoneVerifiedAt = new Date().toISOString()
}

export function setDemoPasswordHash(driverId: number, hash: string): void {
  getDemoAuthState(driverId).passwordHash = hash
}

/** Creates an opaque demo session token and registers it server-side. */
function createDemoSessionToken(driverId: number): { token: string; expiresAt: number } {
  const token = `demo_${driverId}_${randomBytes(24).toString('hex')}`
  const expiresAt = Date.now() + SESSION_TTL_MS
  sessions.set(token, { driverId, expiresAt })
  return { token, expiresAt }
}

/** Resolves a demo session token (e.g. from an Authorization header) to a driver id. */
export function resolveDemoSession(token: string | null): number | null {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return session.driverId
}

/** Builds a Supabase-Session-shaped payload backed by a demo token, for API response compatibility. */
export function buildDemoSession(driverId: number, driverEmail: string): DemoSessionPayload {
  const { token, expiresAt } = createDemoSessionToken(driverId)
  const state = getDemoAuthState(driverId)
  return {
    access_token: token,
    refresh_token: token,
    token_type: 'bearer',
    expires_at: Math.floor(expiresAt / 1000),
    expires_in: Math.floor(SESSION_TTL_MS / 1000),
    user: { id: state.userId, email: driverEmail, role: 'driver' },
  }
}
