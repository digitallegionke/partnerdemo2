import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Schedule = Database['public']['Tables']['schedules']['Row']
type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
type ScheduleUpdate = Database['public']['Tables']['schedules']['Update']

// Schedule with related data for UI
export interface ScheduleWithDetails {
  id: number
  title: string
  route_id: number | null
  driver_id: number | null
  scheduled_date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  notes: string | null
  created_at: string
  updated_at: string
  route?: {
    id: number
    name: string
    start_location: string | null
    end_location: string | null
  } | null
  driver?: {
    id: number
    name: string
    phone: string
    vehicle_type: string
  } | null
  delivery_count?: number
}

export class ScheduleService {
  static async getAllSchedules(): Promise<ScheduleWithDetails[]> {
    // First get all schedules
    const { data: schedulesData, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .order('scheduled_date', { ascending: true })

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError)
      throw schedulesError
    }

    if (!schedulesData || schedulesData.length === 0) {
      return []
    }

    // Get unique route IDs and driver IDs
    const routeIds = [...new Set(schedulesData
      .map(schedule => schedule.route_id)
      .filter(id => id !== null)
    )]
    
    const driverIds = [...new Set(schedulesData
      .map(schedule => schedule.driver_id)
      .filter(id => id !== null)
    )]

    // Fetch routes data
    let routesData: any[] = []
    if (routeIds.length > 0) {
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('id, name, start_location, end_location')
        .in('id', routeIds)

      if (routesError) {
        console.error('Error fetching routes for schedules:', routesError)
      } else {
        routesData = routes || []
      }
    }

    // Fetch drivers data
    let driversData: any[] = []
    if (driverIds.length > 0) {
      const { data: drivers, error: driversError } = await supabase
        .from('drivers')
        .select('id, name, phone, vehicle_type')
        .in('id', driverIds)

      if (driversError) {
        console.error('Error fetching drivers for schedules:', driversError)
      } else {
        driversData = drivers || []
      }
    }

    // Get delivery counts for each route
    const deliveryCounts = new Map<number, number>()
    if (routeIds.length > 0) {
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('route_id')
        .in('route_id', routeIds)

      if (!deliveriesError && deliveries) {
        deliveries.forEach(delivery => {
          if (delivery.route_id) {
            deliveryCounts.set(
              delivery.route_id, 
              (deliveryCounts.get(delivery.route_id) || 0) + 1
            )
          }
        })
      }
    }

    // Create maps for quick lookup
    const routesMap = new Map(routesData.map(route => [route.id, route]))
    const driversMap = new Map(driversData.map(driver => [driver.id, driver]))

    // Transform the data
    return schedulesData.map(schedule => ({
      ...schedule,
      route: schedule.route_id ? routesMap.get(schedule.route_id) || null : null,
      driver: schedule.driver_id ? driversMap.get(schedule.driver_id) || null : null,
      delivery_count: schedule.route_id ? deliveryCounts.get(schedule.route_id) || 0 : 0
    }))
  }

  static async getSchedulesByDate(date: string): Promise<ScheduleWithDetails[]> {
    const schedules = await this.getAllSchedules()
    return schedules.filter(schedule => schedule.scheduled_date === date)
  }

  static async getSchedulesByDateRange(startDate: string, endDate: string): Promise<ScheduleWithDetails[]> {
    const schedules = await this.getAllSchedules()
    return schedules.filter(schedule => 
      schedule.scheduled_date >= startDate && schedule.scheduled_date <= endDate
    )
  }

  static async getScheduleById(id: number): Promise<ScheduleWithDetails | null> {
    const schedules = await this.getAllSchedules()
    return schedules.find(schedule => schedule.id === id) || null
  }

  static async createSchedule(schedule: ScheduleInsert): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .insert([schedule])
      .select()
      .single()

    if (error) {
      console.error('Error creating schedule:', error)
      throw error
    }

    return data
  }

  static async updateSchedule(id: number, updates: ScheduleUpdate): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating schedule:', error)
      throw error
    }

    return data
  }

  static async updateScheduleStatus(id: number, status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'): Promise<Schedule> {
    return this.updateSchedule(id, { status })
  }

  static async deleteSchedule(id: number): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting schedule:', error)
      throw error
    }
  }

  static async getScheduleStats() {
    const { data, error } = await supabase
      .from('schedules')
      .select('status, priority')

    if (error) {
      console.error('Error fetching schedule stats:', error)
      throw error
    }

    const stats = {
      total: data?.length || 0,
      scheduled: data?.filter(s => s.status === 'scheduled').length || 0,
      inProgress: data?.filter(s => s.status === 'in-progress').length || 0,
      completed: data?.filter(s => s.status === 'completed').length || 0,
      cancelled: data?.filter(s => s.status === 'cancelled').length || 0,
      highPriority: data?.filter(s => s.priority === 'high').length || 0,
      mediumPriority: data?.filter(s => s.priority === 'medium').length || 0,
      lowPriority: data?.filter(s => s.priority === 'low').length || 0,
    }

    return stats
  }

  static async getSchedulesByDriver(driverId: number): Promise<ScheduleWithDetails[]> {
    const schedules = await this.getAllSchedules()
    return schedules.filter(schedule => schedule.driver_id === driverId)
  }

  static async getTodaysSchedules(): Promise<ScheduleWithDetails[]> {
    const today = new Date().toISOString().split('T')[0]
    return this.getSchedulesByDate(today)
  }

  static async getUpcomingSchedules(days: number = 7): Promise<ScheduleWithDetails[]> {
    const today = new Date()
    const futureDate = new Date(today)
    futureDate.setDate(today.getDate() + days)
    
    const startDate = today.toISOString().split('T')[0]
    const endDate = futureDate.toISOString().split('T')[0]
    
    return this.getSchedulesByDateRange(startDate, endDate)
  }
} 