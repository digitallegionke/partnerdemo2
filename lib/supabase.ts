import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zolqvkpgiauqnjgujtvl.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: number
          name: string
          phone: string
          email: string | null
          avatar_url: string | null
          status: 'active' | 'inactive' | 'on_break'
          vehicle_type: string
          license_number: string
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          phone: string
          email?: string | null
          avatar_url?: string | null
          status?: 'active' | 'inactive' | 'on_break'
          vehicle_type: string
          license_number: string
        }
        Update: {
          name?: string
          phone?: string
          email?: string | null
          avatar_url?: string | null
          status?: 'active' | 'inactive' | 'on_break'
          vehicle_type?: string
          license_number?: string
        }
      }
      routes: {
        Row: {
          id: number
          name: string
          driver_id: number | null
          status: 'active' | 'completed' | 'pending' | 'cancelled'
          total_distance: number | null
          estimated_duration: number | null
          start_location: string | null
          end_location: string | null
          efficiency_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          driver_id?: number | null
          status?: 'active' | 'completed' | 'pending' | 'cancelled'
          total_distance?: number | null
          estimated_duration?: number | null
          start_location?: string | null
          end_location?: string | null
          efficiency_score?: number | null
        }
        Update: {
          name?: string
          driver_id?: number | null
          status?: 'active' | 'completed' | 'pending' | 'cancelled'
          total_distance?: number | null
          estimated_duration?: number | null
          start_location?: string | null
          end_location?: string | null
          efficiency_score?: number | null
        }
      }
      deliveries: {
        Row: {
          id: number
          route_id: number | null
          farmer_name: string
          location: string
          coordinates: number[] // [lat, lng]
          produce: string
          estimated_value: string | null
          weight: string | null
          phone: string
          drop_time: string
          status: 'pending' | 'in-progress' | 'completed' | 'failed'
          order_index: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          route_id?: number | null
          farmer_name: string
          location: string
          coordinates: number[]
          produce: string
          estimated_value?: string | null
          weight?: string | null
          phone: string
          drop_time: string
          status?: 'pending' | 'in-progress' | 'completed' | 'failed'
          order_index?: number | null
        }
        Update: {
          route_id?: number | null
          farmer_name?: string
          location?: string
          coordinates?: number[]
          produce?: string
          estimated_value?: string | null
          weight?: string | null
          phone?: string
          drop_time?: string
          status?: 'pending' | 'in-progress' | 'completed' | 'failed'
          order_index?: number | null
        }
      }
      route_optimizations: {
        Row: {
          id: number
          route_id: number
          algorithm_used: string
          original_distance: number
          optimized_distance: number
          improvement_percent: number
          time_saved: number
          cost_savings: number
          applied: boolean
          created_at: string
        }
        Insert: {
          route_id: number
          algorithm_used: string
          original_distance: number
          optimized_distance: number
          improvement_percent: number
          time_saved: number
          cost_savings: number
          applied?: boolean
        }
        Update: {
          applied?: boolean
        }
      }
      schedules: {
        Row: {
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
        }
        Insert: {
          title: string
          route_id?: number | null
          driver_id?: number | null
          scheduled_date: string
          start_time: string
          end_time: string
          status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high'
          notes?: string | null
        }
        Update: {
          title?: string
          route_id?: number | null
          driver_id?: number | null
          scheduled_date?: string
          start_time?: string
          end_time?: string
          status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high'
          notes?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper function to get typed Supabase client
export const getSupabaseClient = () => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
} 