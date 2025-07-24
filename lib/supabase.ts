import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zolqvkpgiauqnjgujtvl.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check for missing environment variables
if (!supabaseAnonKey || supabaseAnonKey === 'your_actual_anon_key_here') {
  console.warn('⚠️  MISSING SUPABASE_ANON_KEY: Please add your Supabase anonymous key to .env.local')
  console.warn('   Get your key from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api')
}

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
          customer_name: string
          location: string
          coordinates: string | number[] | object // PostGIS geometry as string, array, or GeoJSON object
          item: string
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
          customer_name: string
          location: string
          coordinates: string | object // PostGIS geometry format
          item: string
          estimated_value?: string | null
          weight?: string | null
          phone: string
          drop_time: string
          status?: 'pending' | 'in-progress' | 'completed' | 'failed'
          order_index?: number | null
        }
        Update: {
          route_id?: number | null
          customer_name?: string
          location?: string
          coordinates?: string | object // PostGIS geometry format
          item?: string
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

// Helper functions for coordinate handling
export const coordinatesToPoint = (coordinates: [number, number]): string => {
  const [lat, lng] = coordinates
  return `(${lng},${lat})` // PostgreSQL point literal format: (longitude,latitude)
}

export const parsePointCoordinates = (coordinates: string | number[] | object): [number, number] => {
  // Handle GeoJSON format object
  if (typeof coordinates === 'object' && coordinates !== null && 'coordinates' in coordinates) {
    const geojson = coordinates as any
    if (geojson.type === 'Point' && Array.isArray(geojson.coordinates)) {
      const [lng, lat] = geojson.coordinates
      return [lat, lng] // Convert to [lat, lng] for frontend
    }
  }
  
  // Handle array format (some Supabase configs return as array)
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    return [coordinates[1], coordinates[0]] // Convert [lng, lat] to [lat, lng]
  }
  
  // Handle PostgreSQL POINT literal format: (lat,lng) or (lng,lat)
  if (typeof coordinates === 'string') {
    // Handle PostgreSQL point literal format: (lat,lng)
    const pointMatch = coordinates.match(/\(([^,]+),([^)]+)\)/)
    if (pointMatch) {
      const lat = parseFloat(pointMatch[1])
      const lng = parseFloat(pointMatch[2])
      return [lat, lng] // Already in [lat, lng] format
    }
    
    // Handle PostGIS WKT POINT format: POINT(lng lat)
    const wktMatch = coordinates.match(/POINT\(([^)]+)\)/)
    if (wktMatch) {
      const [lng, lat] = wktMatch[1].split(' ').map(Number)
      return [lat, lng] // Convert to [lat, lng] for frontend
    }
  }

  // Fallback to Nairobi coordinates if parsing fails
  console.warn('Failed to parse coordinates:', coordinates)
  return [-1.2921, 36.8219] // Default to Nairobi
} 