import { supabase } from '@/lib/supabase'

export interface VrpSolution {
  solutions: Array<{
    route_id: number | null
    vehicle_index: number
    ordered_delivery_ids: number[]
    total_distance_m: number
    total_duration_s: number
    total_distance_km: number
    total_duration_min: number
  }>
  dropped_deliveries: number[]
  status: string
  computation_time_ms: number
}

export class VrpOptimizationService {
  private static baseUrl = '/api/optimize/vrp'

  private static async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }

  /**
   * Optimize routes using Google OR-Tools VRP solver.
   */
  static async optimizeRoutes(params: {
    route_ids?: number[]
    depot?: { lat: number; lng: number }
    vehicle_count?: number
    max_stops_per_vehicle?: number
    max_duration_minutes?: number
    include_unassigned?: boolean
  }): Promise<VrpSolution> {
    const authHeader = await this.getAuthHeader()

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(params),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`)
    }

    return result
  }
}
