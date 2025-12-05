/**
 * AuthService - Handles all authentication API calls
 * 
 * Pattern: Send credentials to backend, backend authenticates with Supabase
 * Returns JWT tokens which are stored by Supabase automatically
 * Frontend then uses tokens for subsequent API calls
 */

import { supabase } from '@/lib/supabase'

export interface AuthResponse {
  success: boolean
  user?: {
    id: string
    email: string
    user_metadata?: {
      full_name?: string
      phone?: string
    }
  }
  session?: {
    access_token: string
    refresh_token: string
  }
  error?: string
}

export class AuthService {
  static async signIn(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    try {
      if (!email || !password) {
        return {
          success: false,
          error: "Email and password are required",
        }
      }

      // Sign in with Supabase directly on the frontend
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: "Authentication failed",
        }
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || "",
          user_metadata: data.user.user_metadata,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error('Error signing in:', error)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  static async signup(
    email: string,
    password: string,
    full_name: string,
    phone?: string
  ): Promise<AuthResponse> {
    try {
      // Sign up with Supabase directly on the frontend
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            phone: phone || null,
          },
        },
      })

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      if (!data.user) {
        return {
          success: false,
          error: "Signup failed",
        }
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || "",
          user_metadata: data.user.user_metadata,
        },
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        } : undefined,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error('Error signing up:', error)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  static async signOut(): Promise<AuthResponse> {
    try {
      // Sign out with Supabase directly
      const { error } = await supabase.auth.signOut()

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error('Error signing out:', error)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  static async getCurrentUser(): Promise<AuthResponse> {
    try {
      // Get current user from Supabase
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        return {
          success: false,
          error: error?.message || "No user session found",
        }
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email || "",
          user_metadata: user.user_metadata,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error('Error getting current user:', error)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

