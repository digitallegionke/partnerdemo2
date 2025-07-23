import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Route = Database['public']['Tables']['routes']['Row']
type RouteInsert = Database['public']['Tables']['routes']['Insert']
type RouteUpdate = Database['public']['Tables']['routes']['Update']

// Extended route type with driver information
export interface RouteWithDriver extends Route {
  driver?: {
    id: number
    name: string
    phone: string
    vehicle_type: string
  } | null
}

export class RouteService {
  static async getAllRoutes(): Promise<RouteWithDriver[]> {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        drivers(id, name, phone, vehicle_type)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching routes:', error)
      throw error
    }

    // Transform the data to match our interface
    return (data || []).map(route => ({
      ...route,
      driver: route.drivers ? route.drivers : null
    }))
  }

  static async getRouteById(id: number): Promise<RouteWithDriver | null> {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        drivers(id, name, phone, vehicle_type)
      `)
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching route:', error)
      throw error
    }

    if (!data) return null

    // Transform the data to match our interface
    return {
      ...data,
      driver: data.drivers ? data.drivers : null
    }
  }

  static async getActiveRoutes(): Promise<RouteWithDriver[]> {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        drivers(id, name, phone, vehicle_type)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching active routes:', error)
      throw error
    }

    // Transform the data to match our interface
    return (data || []).map(route => ({
      ...route,
      driver: route.drivers ? route.drivers : null
    }))
  }

  static async createRoute(route: RouteInsert): Promise<Route> {
    const { data, error } = await supabase
      .from('routes')
      .insert([route])
      .select()
      .single()

    if (error) {
      console.error('Error creating route:', error)
      throw error
    }

    return data
  }

  static async updateRoute(id: number, updates: RouteUpdate): Promise<Route> {
    const { data, error } = await supabase
      .from('routes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating route:', error)
      throw error
    }

    return data
  }

  static async assignDriver(routeId: number, driverId: number): Promise<Route> {
    return this.updateRoute(routeId, { driver_id: driverId })
  }

  static async unassignDriver(routeId: number): Promise<Route> {
    return this.updateRoute(routeId, { driver_id: null })
  }

  static async updateRouteStatus(id: number, status: 'active' | 'completed' | 'pending' | 'cancelled'): Promise<Route> {
    return this.updateRoute(id, { status })
  }

  static async deleteRoute(id: number): Promise<void> {
    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting route:', error)
      throw error
    }
  }

  static async getRouteStats() {
    const { data, error } = await supabase
      .from('routes')
      .select('status, total_distance, estimated_duration, efficiency_score')

    if (error) {
      console.error('Error fetching route stats:', error)
      throw error
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter(r => r.status === 'active').length || 0,
      completed: data?.filter(r => r.status === 'completed').length || 0,
      pending: data?.filter(r => r.status === 'pending').length || 0,
      cancelled: data?.filter(r => r.status === 'cancelled').length || 0,
      totalDistance: data?.reduce((sum, r) => sum + (r.total_distance || 0), 0) || 0,
      totalDuration: data?.reduce((sum, r) => sum + (r.estimated_duration || 0), 0) || 0,
      averageEfficiency: data?.length 
        ? Math.round(data.reduce((sum, r) => sum + (r.efficiency_score || 0), 0) / data.length)
        : 0
    }

    return stats
  }

  static async getRoutesByDriver(driverId: number): Promise<RouteWithDriver[]> {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        drivers(id, name, phone, vehicle_type)
      `)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching routes by driver:', error)
      throw error
    }

    // Transform the data to match our interface
    return (data || []).map(route => ({
      ...route,
      driver: route.drivers ? route.drivers : null
    }))
  }

  // Fallback method without joins for testing
  static async getAllRoutesSimple(): Promise<Route[]> {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching routes (simple):', error)
      throw error
    }

    return data || []
  }

  static async updateRouteMetrics(
    id: number, 
    distance: number, 
    duration: number, 
    efficiency: number
  ): Promise<Route> {
    return this.updateRoute(id, {
      total_distance: distance,
      estimated_duration: duration,
      efficiency_score: efficiency
    })
  }
} 