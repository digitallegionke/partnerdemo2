import { supabase } from './supabase'

/**
 * Get the current JWT access token from Supabase session
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session?.access_token) {
      return null
    }
    
    return session.access_token
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

/**
 * Get headers with JWT token for API requests
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken()
  
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}
