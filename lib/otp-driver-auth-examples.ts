/**
 * Driver OTP Authentication - Testing & Usage Examples
 * 
 * This file contains:
 * 1. cURL command examples for testing the endpoints
 * 2. JavaScript/TypeScript client examples
 * 3. Setup instructions
 * 4. Debugging tips
 */

// ============================================================================
// CURL EXAMPLES
// ============================================================================

/*

## Setup: Replace these values before running
BASE_URL="http://localhost:3000"
PHONE="+1234567890"  # or use format like "1234567890"
OTP="123456"         # You'll get this from Supabase/your SMS provider

## 1. REQUEST OTP
   Initiates OTP delivery to the driver's phone
   Rate limit: 3 requests per phone per 5 minutes

curl -X POST "${BASE_URL}/api/drivers/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"${PHONE}\"
  }"

Response (Success):
{
  "success": true,
  "message": "OTP sent to +1234567890",
  "attemptsRemaining": 2
}

Response (Rate Limited):
{
  "error": "Too many OTP requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 285
}

Response (Invalid Phone):
{
  "error": "Please enter a valid phone number.",
  "code": "INVALID_PHONE"
}

Response (Phone Not Registered):
{
  "error": "This phone number is not registered. Please contact your administrator.",
  "code": "PHONE_NOT_REGISTERED"
}

## 2. VERIFY OTP
   Completes authentication by verifying the OTP code
   Links driver to auth user, marks phone verified, and activates if first login

curl -X POST "${BASE_URL}/api/drivers/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"${PHONE}\",
    \"otp\": \"${OTP}\"
  }"

Response (Success):
{
  "success": true,
  "message": "Authentication successful",
  "isFirstLogin": true,
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "sbr_...",
    "expires_in": 3600,
    "expires_at": 1704067200
  },
  "driver": {
    "id": 1,
    "name": "John Doe",
    "phone": "+1234567890",
    "email": null,
    "status": "active",
    "vehicle_type": "van",
    "license_number": "DL123456",
    "phone_verified_at": "2026-01-05T10:30:00.000Z",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "org_id": 1,
    "created_at": "2025-12-01T08:00:00.000Z",
    "updated_at": "2026-01-05T10:30:00.000Z",
    "avatar_url": null
  }
}

Response (Invalid OTP):
{
  "error": "Invalid OTP code. Please check and try again.",
  "code": "INVALID_OTP"
}

Response (Expired OTP):
{
  "error": "OTP code has expired. Please request a new one.",
  "code": "EXPIRED_OTP"
}

Response (Not a Driver):
{
  "error": "This account is not configured as a driver account.",
  "code": "NOT_A_DRIVER"
}

## 3. FULL WORKFLOW EXAMPLE

# Step 1: Driver requests OTP
curl -X POST "${BASE_URL}/api/drivers/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
# Output: Check email/SMS for OTP code (or check Supabase logs in development)

# Step 2: Driver receives OTP via SMS and verifies it
curl -X POST "${BASE_URL}/api/drivers/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "otp": "123456"}'
# Output: Session token and driver info
# Save the session.access_token for authenticated requests

# Step 3: Use session token for authenticated requests
curl -X GET "${BASE_URL}/api/drivers/1" \
  -H "Authorization: Bearer ${SESSION_TOKEN}"

*/

// ============================================================================
// TYPESCRIPT CLIENT EXAMPLES
// ============================================================================

/*

import type { 
  RequestOtpRequest, 
  RequestOtpResponse, 
  VerifyOtpRequest, 
  VerifyOtpResponse,
  OtpErrorResponse 
} from '@/lib/otp-types';

class DriverOtpClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || '/api';
  }

  // Request OTP for driver login
  async requestOtp(phone: string): Promise<RequestOtpResponse> {
    const response = await fetch(`${this.baseUrl}/drivers/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone } as RequestOtpRequest),
    });

    if (!response.ok) {
      const error = await response.json() as OtpErrorResponse;
      throw new Error(error.error || 'Failed to request OTP');
    }

    return response.json();
  }

  // Verify OTP and complete login
  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    const response = await fetch(`${this.baseUrl}/drivers/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp } as VerifyOtpRequest),
    });

    if (!response.ok) {
      const error = await response.json() as OtpErrorResponse;
      throw new Error(error.error || 'Failed to verify OTP');
    }

    return response.json();
  }
}

// Usage in a React component
function DriverLoginForm() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const client = new DriverOtpClient();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await client.requestOtp(phone);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await client.verifyOtp(phone, otp);
      
      // Save session
      if (response.session?.access_token) {
        localStorage.setItem('driver_session', JSON.stringify(response.session));
        localStorage.setItem('driver_id', response.driver?.id.toString() || '');
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <form onSubmit={handleRequestOtp}>
        <input
          type="tel"
          placeholder="+1234567890"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Request OTP'}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyOtp}>
      <input
        type="text"
        placeholder="Enter 6-digit OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        maxLength={6}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep('phone');
          setOtp('');
        }}
      >
        Back
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

*/

// ============================================================================
// SETUP INSTRUCTIONS
// ============================================================================

/*

## Prerequisites

1. Supabase project configured with phone OTP enabled
   - Go to Supabase dashboard > Authentication > Providers
   - Enable "Phone" provider
   - Configure your SMS provider (Twilio, AWS SNS, etc.)

2. Drivers table with required columns:
   - id (int, primary key)
   - phone (text, unique)
   - name (text)
   - status (enum: active | inactive | pending_activation | on_break)
   - email (text, optional)
   - vehicle_type (text)
   - license_number (text)
   - org_id (int, foreign key)
   - user_id (uuid, nullable - links to auth.users)
   - phone_verified_at (timestamp, nullable)
   - created_at (timestamp)
   - updated_at (timestamp)
   - avatar_url (text, optional)

3. Drivers must be pre-registered by admin
   - Admin creates driver record with phone number
   - Driver uses that phone to request OTP

4. Supabase Auth users must have metadata:
   - user_metadata.role = 'driver' (verified in verify-otp endpoint)

## Database Migration

If you need to add the phone_verified_at column to drivers table:

ALTER TABLE drivers ADD COLUMN phone_verified_at TIMESTAMP NULL;

If you need to add a status column:

ALTER TABLE drivers ADD COLUMN status TEXT DEFAULT 'pending_activation' CHECK (
  status IN ('active', 'inactive', 'pending_activation', 'on_break')
);

*/

// ============================================================================
// DEBUGGING TIPS
// ============================================================================

/*

## Rate Limiting

- The rate limiter is in-memory and tracks per phone number
- Max 3 OTP requests per phone per 5 minutes
- After 3 attempts, you'll get a 429 response with "Retry-After" header
- To reset for testing, restart the server

For production with multiple instances, consider:
  - Upstash Redis: https://upstash.com/
  - Supabase Rate Limiting: https://supabase.com/docs/guides/realtime/rate-limiting
  - Custom implementation using your database

## Phone Number Validation

Accepted formats:
- +1234567890 (E.164 with +)
- +1 (234) 567-8900 (with formatting)
- 1234567890 (without +, will be normalized)

Validation rules:
- 7-15 digits (E.164 standard)
- Can include +, spaces, dashes, parentheses
- All will be normalized to: +[digits]

## OTP Expiry

- OTP codes typically expire in Supabase after 10 minutes
- The exact expiry is configured in your Supabase project
- If "Expired" error, user must request a new OTP

## Testing in Development

1. Check Supabase logs for OTP codes being sent
2. Many SMS providers offer test modes
3. For local testing without SMS:
   - Use Supabase CLI: supabase start
   - Check the inbucket UI (email/SMS preview)

## Common Issues

1. "Phone not registered"
   - Make sure driver was created by admin with correct phone
   - Check phone format matches (must be normalized)

2. "Not a driver role"
   - User metadata must have role: 'driver'
   - Check auth.users table in Supabase

3. "Rate limit exceeded"
   - Wait for the time shown in 'retryAfter' response
   - Restart server to clear in-memory rate limiter (dev only)

4. "Database error"
   - Check Supabase project status
   - Verify drivers table exists with correct schema
   - Check org_id matches if using organization filtering

*/

export {};
