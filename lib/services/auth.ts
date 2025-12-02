import { supabase } from "@/lib/supabase"

interface SignInCredentials {
  email: string
  password: string
}

interface SignInResponse {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      user_metadata?: {
        full_name?: string
        phone?: string
      }
    }
    session: {
      access_token: string
      refresh_token: string
    }
  }
  error?: string
}

export class AuthService {
  static async signIn(credentials: SignInCredentials): Promise<SignInResponse> {
    try {
      const { email, password } = credentials

      if (!email || !password) {
        return {
          success: false,
          error: "Email and password are required",
        }
      }

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
          error: "Authentication failed. Please try again.",
        }
      }

      return {
        success: true,
        data: {
          user: {
            id: data.user.id,
            email: data.user.email || "",
            user_metadata: {
              full_name: data.user.user_metadata?.full_name,
              phone: data.user.user_metadata?.phone,
            },
          },
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
        },
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  static async signOut(): Promise<SignInResponse> {
    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  static async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      if (!data.user) {
        return {
          success: false,
          error: "No user session found",
        }
      }

      return {
        success: true,
        data: {
          user: {
            id: data.user.id,
            email: data.user.email || "",
            user_metadata: {
              full_name: data.user.user_metadata?.full_name,
              phone: data.user.user_metadata?.phone,
            },
          },
        },
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}
