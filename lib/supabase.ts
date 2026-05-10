import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Check for missing environment variables
if (!supabaseAnonKey || !supabaseUrl) {
  throw new Error("Missing Supabase environment variables");
}

export const createAuthenticatedClient = (authorization: string | null) => {
  if (!authorization) {
    throw new Error('Authorization header required')
  }
  
  const token = authorization.replace('Bearer ', '')
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })
}

/** Public (anon) key — use for unauthenticated driver-auth routes; pair with RPCs / RLS, not service role. */
export const createAnonClient = () => createClient(supabaseUrl, supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: number;
          name: string;
          phone: string;
          email: string | null;
          avatar_url: string | null;
          status: "active" | "inactive" | "on_break";
          vehicle_type: string;
          license_number: string;
          created_at: string;
          updated_at: string;
          org_id: number;
          user_id: string | null;
          phone_verified_at: string | null;
          // Setup OTP fields for initial driver login
          setup_otp_hash: string | null;
          setup_otp_expires_at: string | null;
          setup_otp_used: boolean | null;
          // Live location fields
          last_known_lat: number | null;
          last_known_lng: number | null;
          last_location_at: string | null;
          is_online: boolean;
        };
        Insert: {
          name: string;
          phone: string;
          email?: string | null;
          avatar_url?: string | null;
          status?: "active" | "inactive" | "on_break";
          vehicle_type: string;
          license_number: string;
          org_id: number;
          user_id?: string | null;
          phone_verified_at?: string | null;
          // Setup OTP fields
          setup_otp_hash?: string | null;
          setup_otp_expires_at?: string | null;
          setup_otp_used?: boolean | null;
          // Live location fields
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          last_location_at?: string | null;
          is_online?: boolean;
        };
        Update: {
          name?: string;
          phone?: string;
          email?: string | null;
          avatar_url?: string | null;
          status?: "active" | "inactive" | "on_break";
          vehicle_type?: string;
          license_number?: string;
          user_id?: string | null;
          phone_verified_at?: string | null;
          // Setup OTP fields
          setup_otp_hash?: string | null;
          setup_otp_expires_at?: string | null;
          setup_otp_used?: boolean | null;
          // Live location fields
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          last_location_at?: string | null;
          is_online?: boolean;
        };
      };
      routes: {
        Row: {
          id: number;
          name: string;
          driver_id: number | null;
          status: "active" | "completed" | "pending" | "cancelled";
          total_distance: number | null;
          estimated_duration: number | null;
          start_location: string | null;
          end_location: string | null;
          efficiency_score: number | null;
          created_at: string;
          updated_at: string;
          lat: string;
          lng: string;
        };
        Insert: {
          name: string;
          driver_id?: number | null;
          status?: "active" | "completed" | "pending" | "cancelled";
          total_distance?: number | null;
          estimated_duration?: number | null;
          start_location?: string | null;
          end_location?: string | null;
          efficiency_score?: number | null;
          lat: string;
          lng: string;
        };
        Update: {
          name?: string;
          driver_id?: number | null;
          status?: "active" | "completed" | "pending" | "cancelled";
          total_distance?: number | null;
          estimated_duration?: number | null;
          start_location?: string | null;
          end_location?: string | null;
          efficiency_score?: number | null;
          lat?: string;
          lng?: string;
        };
      };
      partner_routes: {
        Row: {
          id: number;
          provider_id: number;
          name: string;
          driver_id: number | null;
          status: "active" | "completed" | "pending" | "cancelled";
          total_distance: number | null;
          estimated_duration: number | null;
          start_location: string | null;
          end_location: string | null;
          efficiency_score: number | null;
          lat: string;
          lng: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: number;
          name: string;
          driver_id?: number | null;
          status?: "active" | "completed" | "pending" | "cancelled";
          total_distance?: number | null;
          estimated_duration?: number | null;
          start_location?: string | null;
          end_location?: string | null;
          efficiency_score?: number | null;
          lat?: string;
          lng?: string;
        };
        Update: {
          name?: string;
          driver_id?: number | null;
          status?: "active" | "completed" | "pending" | "cancelled";
          total_distance?: number | null;
          estimated_duration?: number | null;
          start_location?: string | null;
          end_location?: string | null;
          efficiency_score?: number | null;
          lat?: string;
          lng?: string;
        };
      };
      deliveries: {
        Row: {
          id: number;
          route_id: number | null;
          customer_name: string;
          location: string;
          coordinates: string | number[] | object;
          item: string;
          estimated_value: string | null;
          weight: string | null;
          phone: string;
          drop_time: string;
          status: "pending" | "in-progress" | "completed" | "failed";
          order_index: number | null;
          created_at: string;
          updated_at: string;
          assigned_to?: number | null;
          delivered_at?: string;
          delivery_notes?: string | null;
          proof_of_delivery?: string | null;
          attempt_count?: number;
          time_window_start?: string | null;
          time_window_end?: string | null;
          demand?: number;
        };
        Insert: {
          route_id?: number | null;
          customer_name: string;
          location: string;
          coordinates: string | object;
          item: string;
          estimated_value?: string | null;
          weight?: string | null;
          phone: string;
          drop_time: string;
          status?: "pending" | "in-progress" | "completed" | "failed";
          order_index?: number | null;
          delivery_notes?: string | null;
          proof_of_delivery?: string | null;
          attempt_count?: number;
        };
        Update: {
          route_id?: number | null;
          customer_name?: string;
          location?: string;
          coordinates?: string | object;
          item?: string;
          estimated_value?: string | null;
          weight?: string | null;
          phone?: string;
          drop_time?: string;
          status?: "pending" | "in-progress" | "completed" | "failed";
          order_index?: number | null;
          delivery_notes?: string | null;
          proof_of_delivery?: string | null;
          attempt_count?: number;
        };
      };
      partner_deliveries: {
        Row: {
          id: number;
          provider_id: number;
          route_id: number | null;
          customer_name: string;
          location: string;
          coordinates: string | null;
          item: string;
          estimated_value: string | null;
          weight: string | null;
          phone: string;
          drop_time: string;
          status: "pending" | "in-progress" | "completed" | "failed";
          order_index: number | null;
          delivery_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: number;
          route_id?: number | null;
          customer_name: string;
          location: string;
          coordinates?: string | null;
          item: string;
          estimated_value?: string | null;
          weight?: string | null;
          phone: string;
          drop_time: string;
          status?: "pending" | "in-progress" | "completed" | "failed";
          order_index?: number | null;
          delivery_notes?: string | null;
        };
        Update: {
          route_id?: number | null;
          customer_name?: string;
          location?: string;
          coordinates?: string | null;
          item?: string;
          estimated_value?: string | null;
          weight?: string | null;
          phone?: string;
          drop_time?: string;
          status?: "pending" | "in-progress" | "completed" | "failed";
          order_index?: number | null;
          delivery_notes?: string | null;
        };
      };
      route_optimizations: {
        Row: {
          id: number;
          route_id: number;
          algorithm_used: string;
          original_distance: number;
          optimized_distance: number;
          improvement_percent: number;
          time_saved: number;
          cost_savings: number;
          applied: boolean;
          created_at: string;
        };
        Insert: {
          route_id: number;
          algorithm_used: string;
          original_distance: number;
          optimized_distance: number;
          improvement_percent: number;
          time_saved: number;
          cost_savings: number;
          applied?: boolean;
        };
        Update: {
          applied?: boolean;
        };
      };
      schedules: {
        Row: {
          id: number;
          title: string;
          route_id: number | null;
          driver_id: number | null;
          scheduled_date: string;
          start_time: string;
          end_time: string;
          status: "scheduled" | "in-progress" | "completed" | "cancelled";
          priority: "low" | "medium" | "high";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          route_id?: number | null;
          driver_id?: number | null;
          scheduled_date: string;
          start_time: string;
          end_time: string;
          status?: "scheduled" | "in-progress" | "completed" | "cancelled";
          priority?: "low" | "medium" | "high";
          notes?: string | null;
        };
        Update: {
          title?: string;
          route_id?: number | null;
          driver_id?: number | null;
          scheduled_date?: string;
          start_time?: string;
          end_time?: string;
          status?: "scheduled" | "in-progress" | "completed" | "cancelled";
          priority?: "low" | "medium" | "high";
          notes?: string | null;
        };
      };
      business_profile: {
        Row: {
          id: number;
          business_name: string;
          contact_email: string;
          contact_phone: string;
          business_address: string | null;
          website: string | null;
          orders_per_day: string | null;
          team_size: string | null;
          drivers_count: string | null;
          years_in_business: string | null;
          industry: string | null;
          primary_delivery_area: string | null;
          delivery_challenge: string | null;
          desired_features: string | null;
          business_status: "pending" | "active" | "inactive" | "suspended";
          profile_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          business_name: string;
          contact_email: string;
          contact_phone: string;
          business_address?: string | null;
          website?: string | null;
          orders_per_day?: string | null;
          team_size?: string | null;
          drivers_count?: string | null;
          years_in_business?: string | null;
          industry?: string | null;
          primary_delivery_area?: string | null;
          delivery_challenge?: string | null;
          desired_features?: string | null;
          business_status?: "pending" | "active" | "inactive" | "suspended";
          profile_completed?: boolean;
        };
        Update: {
          business_name?: string;
          contact_email?: string;
          contact_phone?: string;
          business_address?: string | null;
          website?: string | null;
          orders_per_day?: string | null;
          team_size?: string | null;
          drivers_count?: string | null;
          years_in_business?: string | null;
          industry?: string | null;
          primary_delivery_area?: string | null;
          delivery_challenge?: string | null;
          desired_features?: string | null;
          business_status?: "pending" | "active" | "inactive" | "suspended";
          profile_completed?: boolean;
        };
      };
      driver_locations: {
        Row: {
          id: number;
          driver_id: number;
          route_id: number | null;
          latitude: number;
          longitude: number;
          heading: number | null;
          speed: number | null;
          accuracy: number | null;
          battery_level: number | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          driver_id: number;
          route_id?: number | null;
          latitude: number;
          longitude: number;
          heading?: number | null;
          speed?: number | null;
          accuracy?: number | null;
          battery_level?: number | null;
          recorded_at?: string;
        };
        Update: {
          route_id?: number | null;
          latitude?: number;
          longitude?: number;
          heading?: number | null;
          speed?: number | null;
          accuracy?: number | null;
          battery_level?: number | null;
        };
      };
      route_polylines: {
        Row: {
          id: number;
          route_id: number;
          encoded_polyline: string;
          waypoints: Array<{ lat: number; lng: number }>;
          total_distance_m: number | null;
          total_duration_s: number | null;
          computed_at: string;
        };
        Insert: {
          route_id: number;
          encoded_polyline: string;
          waypoints: Array<{ lat: number; lng: number }>;
          total_distance_m?: number | null;
          total_duration_s?: number | null;
        };
        Update: {
          encoded_polyline?: string;
          waypoints?: Array<{ lat: number; lng: number }>;
          total_distance_m?: number | null;
          total_duration_s?: number | null;
        };
      };
      collection_points: {
        Row: {
          id: string;
          name: string;
          address: string;
          coordinates: string | number[] | object; 
          locationName: string | null;
          type: "warehouse" | "depot" | "pickup_point" | "hub";
          capacity: number;
          openingHours: string;
          closingHours: string;
          contactPerson: string;
          phone: string;
          email: string | null;
          status: "active" | "inactive" | "maintenance";
          assignmentVehicles: number;
          description: string | null;
          createdAt: string;
          lastUpdated: string;
          organization_id: number;
          created_by: string;
          updated_by: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          coordinates?: string | object; 
          locationName?: string | null;
          type: "warehouse" | "depot" | "pickup_point" | "hub";
          capacity: number;
          openingHours: string;
          closingHours: string;
          contactPerson: string;
          phone: string;
          email?: string | null;
          status?: "active" | "inactive" | "maintenance";
          assignmentVehicles?: number;
          description?: string | null;
          createdAt?: string;
          lastUpdated?: string;
          organization_id: number;
          created_by: string;
          updated_by: string;
          user_id: string;
        };
        Update: {
          name?: string;
          address?: string;
          coordinates?: string | object; 
          locationName?: string | null;
          type?: "warehouse" | "depot" | "pickup_point" | "hub";
          capacity?: number;
          openingHours?: string;
          closingHours?: string;
          contactPerson?: string;
          phone?: string;
          email?: string | null;
          status?: "active" | "inactive" | "maintenance";
          assignmentVehicles?: number;
          description?: string | null;
          createdAt?: string;
          lastUpdated?: string;
          updated_by?: string;
        };
      };
      partner_providers: {
        Row: {
          id: number;
          organization_id: number | null;
          provider_name: string;
          legal_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          country: string | null;
          city: string | null;
          address: string | null;
          logo_url: string | null;
          service_mode: "allocation" | "managed_delivery" | "both" | null;
          status: "pending" | "active" | "suspended";
          onboarding_completed: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id?: number | null;
          provider_name: string;
          legal_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          country?: string | null;
          city?: string | null;
          address?: string | null;
          logo_url?: string | null;
          service_mode?: "allocation" | "managed_delivery" | "both" | null;
          status?: "pending" | "active" | "suspended";
          onboarding_completed?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: number | null;
          provider_name?: string;
          legal_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          country?: string | null;
          city?: string | null;
          address?: string | null;
          logo_url?: string | null;
          service_mode?: "allocation" | "managed_delivery" | "both" | null;
          status?: "pending" | "active" | "suspended";
          onboarding_completed?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_provider_users: {
        Row: {
          id: number;
          provider_id: number;
          user_id: string;
          role: string;
          is_primary: boolean;
          is_active: boolean;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: number;
          user_id: string;
          role?: string;
          is_primary?: boolean;
          is_active?: boolean;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_id?: number;
          user_id?: string;
          role?: string;
          is_primary?: boolean;
          is_active?: boolean;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_drivers: {
        Row: {
          id: number;
          provider_id: number;
          full_name: string;
          phone_number: string;
          email: string | null;
          license_number: string;
          license_type: string;
          primary_zone: string | null;
          status: "active" | "inactive" | "on_trip" | "off_duty";
          is_online: boolean;
          last_known_lat: number | null;
          last_known_lng: number | null;
          last_location_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: number;
          full_name: string;
          phone_number: string;
          email?: string | null;
          license_number: string;
          license_type: string;
          primary_zone?: string | null;
          status?: "active" | "inactive" | "on_trip" | "off_duty";
          is_online?: boolean;
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          last_location_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_id?: number;
          full_name?: string;
          phone_number?: string;
          email?: string | null;
          license_number?: string;
          license_type?: string;
          primary_zone?: string | null;
          status?: "active" | "inactive" | "on_trip" | "off_duty";
          is_online?: boolean;
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          last_location_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_allocation_requests: {
        Row: {
          id: number;
          business_id: number;
          service_provider_id: number;
          drivers_requested: number;
          start_date: string;
          end_date: string | null;
          status:
            | "pending"
            | "accepted"
            | "partially_allocated"
            | "fully_allocated"
            | "rejected"
            | "cancelled"
            | "completed";
          notes: string | null;
          business_notes: string | null;
          provider_notes: string | null;
          reviewed_at: string | null;
          requested_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          business_id: number;
          service_provider_id: number;
          drivers_requested: number;
          start_date: string;
          end_date?: string | null;
          status?:
            | "pending"
            | "accepted"
            | "partially_allocated"
            | "fully_allocated"
            | "rejected"
            | "cancelled"
            | "completed";
          notes?: string | null;
          business_notes?: string | null;
          provider_notes?: string | null;
          reviewed_at?: string | null;
          requested_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: number;
          service_provider_id?: number;
          drivers_requested?: number;
          start_date?: string;
          end_date?: string | null;
          status?:
            | "pending"
            | "accepted"
            | "partially_allocated"
            | "fully_allocated"
            | "rejected"
            | "cancelled"
            | "completed";
          notes?: string | null;
          business_notes?: string | null;
          provider_notes?: string | null;
          reviewed_at?: string | null;
          requested_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_driver_allocations: {
        Row: {
          id: number;
          request_id: number;
          driver_id: number;
          vehicle_id: number | null;
          status: "assigned" | "accepted" | "in_progress" | "released" | "cancelled";
          allocated_from: string;
          allocated_until: string | null;
          allocation_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          request_id: number;
          driver_id: number;
          vehicle_id?: number | null;
          status?: "assigned" | "accepted" | "in_progress" | "released" | "cancelled";
          allocated_from?: string;
          allocated_until?: string | null;
          allocation_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          request_id?: number;
          driver_id?: number;
          vehicle_id?: number | null;
          status?: "assigned" | "accepted" | "in_progress" | "released" | "cancelled";
          allocated_from?: string;
          allocated_until?: string | null;
          allocation_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_provider_service_capabilities: {
        Row: {
          id: number;
          provider_id: number;
          service_area: string | null;
          vehicle_type: string;
          max_concurrent_drivers: number;
          available_from: string | null;
          available_to: string | null;
          supports_weekends: boolean;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: number;
          service_area?: string | null;
          vehicle_type: string;
          max_concurrent_drivers?: number;
          available_from?: string | null;
          available_to?: string | null;
          supports_weekends?: boolean;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_id?: number;
          service_area?: string | null;
          vehicle_type?: string;
          max_concurrent_drivers?: number;
          available_from?: string | null;
          available_to?: string | null;
          supports_weekends?: boolean;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_vehicles: {
        Row: {
          id: number;
          provider_id: number;
          vehicle_type: "motorbike" | "car" | "van" | "truck" | "bicycle" | "other";
          make: string | null;
          model: string | null;
          year: number | null;
          plate_number: string;
          color: string | null;
          capacity_kg: number | null;
          status: string;
          vin: string | null;
          fuel_type: string | null;
          odometer_km: number | null;
          allowed_license: string | null;
          assigned_driver_id: number | null;
          last_service_date: string | null;
          insurance_expiry: string | null;
          inspection_expiry: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          provider_id: number;
          vehicle_type: "motorbike" | "car" | "van" | "truck" | "bicycle" | "other";
          make?: string | null;
          model?: string | null;
          year?: number | null;
          plate_number: string;
          color?: string | null;
          capacity_kg?: number | null;
          status?: string;
          vin?: string | null;
          fuel_type?: string | null;
          odometer_km?: number | null;
          allowed_license?: string | null;
          assigned_driver_id?: number | null;
          last_service_date?: string | null;
          insurance_expiry?: string | null;
          inspection_expiry?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_id?: number;
          vehicle_type?: "motorbike" | "car" | "van" | "truck" | "bicycle" | "other";
          make?: string | null;
          model?: string | null;
          year?: number | null;
          plate_number?: string;
          color?: string | null;
          capacity_kg?: number | null;
          status?: string;
          vin?: string | null;
          fuel_type?: string | null;
          odometer_km?: number | null;
          allowed_license?: string | null;
          assigned_driver_id?: number | null;
          last_service_date?: string | null;
          insurance_expiry?: string | null;
          inspection_expiry?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      partner_driver_vehicle_assignments: {
        Row: {
          id: number;
          driver_id: number;
          vehicle_id: number;
          assigned_from: string;
          assigned_to: string | null;
          is_active: boolean;
          assigned_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          driver_id: number;
          vehicle_id: number;
          assigned_from?: string;
          assigned_to?: string | null;
          is_active?: boolean;
          assigned_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          driver_id?: number;
          vehicle_id?: number;
          assigned_from?: string;
          assigned_to?: string | null;
          is_active?: boolean;
          assigned_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      partner_allocation_status: "assigned" | "accepted" | "in_progress" | "released" | "cancelled";
      partner_driver_status: "active" | "inactive" | "on_trip" | "off_duty";
      partner_provider_status: "pending" | "active" | "suspended";
      partner_request_status:
        | "pending"
        | "accepted"
        | "partially_allocated"
        | "fully_allocated"
        | "rejected"
        | "cancelled"
        | "completed";
      partner_vehicle_type: "motorbike" | "car" | "van" | "truck" | "bicycle" | "other";
    };
  };
}

// Helper function to get typed Supabase client
export const getSupabaseClient = () => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
};

// Helper functions for coordinate handling
export const coordinatesToPoint = (coordinates: [number, number]): string => {
  const [lat, lng] = coordinates;
  return `(${lng},${lat})`; // PostgreSQL point literal format: (longitude,latitude)
};

export const parsePointCoordinates = (
  coordinates: string | number[] | object
): [number, number] => {
  // Handle GeoJSON format object
  if (
    typeof coordinates === "object" &&
    coordinates !== null &&
    "coordinates" in coordinates
  ) {
    const geojson = coordinates as any;
    if (geojson.type === "Point" && Array.isArray(geojson.coordinates)) {
      const [lng, lat] = geojson.coordinates;
      return [lat, lng]; // Convert to [lat, lng] for frontend
    }
  }

  // Handle array format (some Supabase configs return as array)
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    return [coordinates[1], coordinates[0]]; // Convert [lng, lat] to [lat, lng]
  }

  // Handle PostgreSQL POINT literal format: (lat,lng) or (lng,lat)
  if (typeof coordinates === "string") {
    // Handle PostgreSQL point literal format: (lat,lng)
    const pointMatch = coordinates.match(/\(([^,]+),([^)]+)\)/);
    if (pointMatch) {
      const lat = parseFloat(pointMatch[1]);
      const lng = parseFloat(pointMatch[2]);
      return [lat, lng]; // Already in [lat, lng] format
    }

    // Handle PostGIS WKT POINT format: POINT(lng lat)
    const wktMatch = coordinates.match(/POINT\(([^)]+)\)/);
    if (wktMatch) {
      const [lng, lat] = wktMatch[1].split(" ").map(Number);
      return [lat, lng]; // Convert to [lat, lng] for frontend
    }
  }

  // Fallback to Nairobi coordinates if parsing fails
  console.warn("Failed to parse coordinates:", coordinates);
  return [-1.2921, 36.8219]; // Default to Nairobi
};