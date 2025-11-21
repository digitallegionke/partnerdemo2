/**
 * AuthService - Handles all authentication API calls
 * 
 * - Makes API calls to backend endpoints instead of calling Supabase directly
 * - Includes credentials for authentication
 * - Handles errors consistently
 */

export interface AuthResponse {
  user?: {
    id: string
    email: string
    user_metadata?: {
      full_name?: string
      phone?: string
    }
  }
  error?: string
}

export class AuthService {
  static async signup(
    email: string,
    password: string,
    full_name: string,
    phone?: string
  ): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          full_name,
          phone: phone || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error signing up:', error)
      throw error
    }
  }
}
