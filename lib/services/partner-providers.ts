import { supabase } from '@/lib/supabase'

export interface ProviderRegisterInput {
  businessName: string
  contactPerson: string
  email: string
  phoneNumber: string
  serviceMode: 'allocation' | 'managed_delivery' | 'both'
  password: string
}

export interface ProviderRegisterResponse {
  success: boolean
  message?: string
  provider?: {
    id: number
    provider_name: string
    status: 'pending' | 'active' | 'suspended'
  }
  user?: {
    id: string
    email: string | undefined
  }
  error?: string
}

export interface ProviderSignInResponse {
  success: boolean
  user?: {
    id: string
    email: string | undefined
    user_metadata?: Record<string, unknown>
  }
  provider?: {
    id: number
    provider_name: string
    status: 'pending' | 'active' | 'suspended'
    role: string
  }
  error?: string
}

export class PartnerProviderService {
  private static baseUrl = '/api/partner-providers'
  private static authUrl = '/api/auth'

  static async register(input: ProviderRegisterInput): Promise<ProviderRegisterResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' }
      }

      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      console.error('Error registering service provider:', error)
      return { success: false, error: message }
    }
  }

  static async signIn(email: string, password: string): Promise<ProviderSignInResponse> {
    try {
      const response = await fetch(`${this.authUrl}/partner-signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Sign in failed' }
      }

      // Hydrate the client-side Supabase session so subsequent client calls work
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      return {
        success: true,
        user: data.user,
        provider: data.provider,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      console.error('Error signing in service provider:', error)
      return { success: false, error: message }
    }
  }

  static async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : ''

      const response = await fetch(`${this.authUrl}/partner-signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
      })

      // Always clear the client-side session regardless of API response
      await supabase.auth.signOut()

      if (!response.ok) {
        const data = await response.json()
        return { success: false, error: data.error || 'Sign out failed' }
      }

      return { success: true }
    } catch (error) {
      // Even on error, clear the local session
      await supabase.auth.signOut()
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      console.error('Error signing out service provider:', error)
      return { success: false, error: message }
    }
  }
}
