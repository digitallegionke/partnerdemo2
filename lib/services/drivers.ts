import type { Database } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

type Driver = Database["public"]["Tables"]["partner_drivers"]["Row"];
type DriverInsert = Database["public"]["Tables"]["partner_drivers"]["Insert"];
type DriverUpdate = Database["public"]["Tables"]["partner_drivers"]["Update"];

// Client-side driver creation type - provider_id is added by the API
type DriverCreateInput = Omit<DriverInsert, 'provider_id'>;

// Extended response type for driver creation that includes the setup OTP
export interface DriverCreateResponse extends Driver {
  setupOtp?: string;
}

export class DriverService {
  private static baseUrl = '/api/drivers'
  
  // Get auth token from Supabase session
  private static async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }

  // fetch wrapper with auth
  private static async fetchWithAuth(url: string, options: RequestInit = {}) {
    const authHeader = await this.getAuthHeader()
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        ...options.headers,
      },
    })

    if (response.status === 204) return null

    const result = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('API Error Response:', result)
      throw new Error(result?.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return result
  }

  static async getAllDrivers(): Promise<Driver[]> {
    try {
      const data = await this.fetchWithAuth(this.baseUrl, { method: 'GET' })
      return data || []
    } catch (error) {
      console.error('Error fetching drivers:', error)
      throw error
    }
  }

  static async getDriverById(id: number): Promise<Driver | null> {
    try {
      const data = await this.fetchWithAuth(`${this.baseUrl}/${id}`, { method: 'GET' })
      return data
    } catch (error) {
      console.error('Error fetching driver:', error)
      throw error
    }
  }

  static async getActiveDrivers(): Promise<Driver[]> {
    const all = await this.getAllDrivers()
    return (all || []).filter((d) => d.is_active)
  }

  /**
   * Create a new driver
   * Returns driver data along with a one-time setup OTP for initial login
   * Note: org_id is automatically added by the API based on the authenticated user
   */
  static async createDriver(driver: DriverCreateInput): Promise<DriverCreateResponse> {
    try {
      const data = await this.fetchWithAuth(this.baseUrl, {
        method: 'POST',
        body: JSON.stringify(driver),
      })
      return data
    } catch (error) {
      console.error('Error creating driver:', error)
      throw error
    }
  }

  static async updateDriver(
    id: number,
    updates: DriverUpdate
  ): Promise<Driver> {
    try {
      const data = await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      return data
    } catch (error) {
      console.error('Error updating driver:', error)
      throw error
    }
  }

  static async updateDriverAvailability(
    id: number,
    availability: "available" | "on_duty" | "off_duty"
  ): Promise<Driver> {
    return this.updateDriver(id, { availability });
  }

  static async deleteDriver(id: number): Promise<void> {
    try {
      await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      })
      return
    } catch (error) {
      console.error('Error deleting driver:', error)
      throw error
    }
  }

  static async getDriverStats() {
    const drivers = await this.getAllDrivers()
    const stats = {
      total:     drivers.length,
      active:    drivers.filter((d) => d.is_active).length,
      inactive:  drivers.filter((d) => !d.is_active).length,
      available: drivers.filter((d) => d.is_active && d.availability === 'available').length,
      on_duty:   drivers.filter((d) => d.is_active && d.availability === 'on_duty').length,
      off_duty:  drivers.filter((d) => d.is_active && d.availability === 'off_duty').length,
    }
    return stats
  }

  /**
   * Regenerate setup OTP for an existing driver
   * Use when the original OTP expired or was lost
   */
  static async regenerateSetupOtp(id: number): Promise<{ setupOtp: string; expiresAt: string }> {
    try {
      const data = await this.fetchWithAuth(`${this.baseUrl}/${id}/regenerate-otp`, {
        method: 'POST',
      })
      return {
        setupOtp: data.setupOtp,
        expiresAt: data.expiresAt,
      }
    } catch (error) {
      console.error('Error regenerating setup OTP:', error)
      throw error
    }
  }
}
