import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface DriverLocation {
  driver_id: number
  name: string
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  route_id: number | null
  recorded_at: string | null
  is_online: boolean
}

export class DriverLocationService {
  private static baseUrl = '/api/drivers'

  private static async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }

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
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`)
    }
    return result
  }

  /**
   * Driver app posts GPS location
   */
  static async postLocation(data: {
    latitude: number
    longitude: number
    heading?: number
    speed?: number
    accuracy?: number
    battery_level?: number
    route_id?: number
  }) {
    return this.fetchWithAuth(`${this.baseUrl}/location`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Dashboard fetches latest positions for all org drivers
   */
  static async getLatestLocations(): Promise<DriverLocation[]> {
    const result = await this.fetchWithAuth(`${this.baseUrl}/locations`, { method: 'GET' })
    return result.drivers || []
  }

  /**
   * Subscribe to real-time driver location updates via Supabase Realtime.
   * Listens for INSERTs on the driver_locations table.
   */
  static subscribeToLocations(
    onUpdate: (location: {
      driver_id: number
      lat: number
      lng: number
      heading: number | null
      speed: number | null
      route_id: number | null
      recorded_at: string
    }) => void,
    routeId?: number
  ): RealtimeChannel {
    const channelName = routeId ? `driver-locations-route-${routeId}` : 'driver-locations-all'

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          ...(routeId ? { filter: `route_id=eq.${routeId}` } : {}),
        },
        (payload) => {
          const row = payload.new as any
          onUpdate({
            driver_id: row.driver_id,
            lat: row.latitude,
            lng: row.longitude,
            heading: row.heading,
            speed: row.speed,
            route_id: row.route_id,
            recorded_at: row.recorded_at,
          })
        }
      )
      .subscribe()

    return channel
  }

  /**
   * Unsubscribe from a realtime channel
   */
  static unsubscribe(channel: RealtimeChannel): void {
    supabase.removeChannel(channel)
  }
}
