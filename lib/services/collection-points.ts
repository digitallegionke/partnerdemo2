// Use database schema directly - no transformation needed
import { supabase, type Database, coordinatesToPoint, parsePointCoordinates } from '@/lib/supabase'

type CollectionPoint = Database['public']['Tables']['collection_points']['Row']
type CollectionPointInsert = Database['public']['Tables']['collection_points']['Insert']
type CollectionPointUpdate = Database['public']['Tables']['collection_points']['Update']

export type { CollectionPoint, CollectionPointInsert, CollectionPointUpdate }

// Collection point type for the frontend with coordinates as array
export interface CollectionPointForMap {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lat, lng]
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
}

// Client-side API service for collection points
export class CollectionPointService {
  private static baseUrl = '/api/collection-points'
  
  // Get auth token from Supabase client
  private static async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('Session exists:', !!session)
    console.log('Access token exists:', !!session?.access_token)
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

    const result = await response.json()

    if (!response.ok) {
      console.error('API Error Response:', result)
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return result
  }

 
  // GET all collection points
  static async getAllCollectionPoints(filters?: {
    type?: string
    status?: string
    search?: string
  }): Promise<CollectionPoint[]> {
    const params = new URLSearchParams()
    
    if (filters?.type) params.append('type', filters.type)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.search) params.append('search', filters.search)
    
    const url = `${this.baseUrl}${params.toString() ? `?${params.toString()}` : ''}`
    const result = await this.fetchWithAuth(url)
    
    return result.data
  }

  // GET single collection point
  static async getCollectionPointById(id: string): Promise<CollectionPoint | null> {
    try {
      const result = await this.fetchWithAuth(`${this.baseUrl}/${id}`)
      return result.data
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  // POST create collection point
  static async createCollectionPoint(data: Partial<CollectionPointInsert> & { 
    name: string;
    address: string;
    type: "warehouse" | "depot" | "pickup_point" | "hub";
    capacity: number;
    openingHours: string;
    closingHours: string;
    contactPerson: string;
    phone: string;
    coordinates?: [number, number];
  }): Promise<CollectionPoint> {
    const result = await this.fetchWithAuth(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result.data
  }

  // PATCH update collection point
  static async updateCollectionPoint(id: string, data: Partial<CollectionPointUpdate> & { coordinates?: [number, number] }): Promise<CollectionPoint> {
    const result = await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return result.data
  }

  // DELETE collection point
  static async deleteCollectionPoint(id: string): Promise<void> {
    await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    })
  }

  // Get collection point statistics
  static async getCollectionPointStats() {
    const points = await this.getAllCollectionPoints()
    
    return {
      total: points.length,
      active: points.filter(p => p.status === 'active').length,
      inactive: points.filter(p => p.status === 'inactive').length,
      maintenance: points.filter(p => p.status === 'maintenance').length,
      totalVehicles: points.reduce((sum, p) => sum + p.assignmentVehicles, 0),
      byType: {
        warehouse: points.filter(p => p.type === 'warehouse').length,
        depot: points.filter(p => p.type === 'depot').length,
        hub: points.filter(p => p.type === 'hub').length,
        'pickup_point': points.filter(p => p.type === 'pickup_point').length,
      }
    }
  }

  // Transform database collection point to frontend format
  static transformCollectionPointForMap(point: CollectionPoint): CollectionPointForMap {
    // Parse coordinates from PostgreSQL POINT format to array
    const coordinates: [number, number] = point.coordinates ? parsePointCoordinates(point.coordinates) : [-1.2921, 36.8219]; // Default to Nairobi

    return {
      ...point,
      coordinates,
    };
  }

  // Transform frontend collection point to database format  
  static transformCollectionPointForDB(point: CollectionPointForMap): CollectionPointInsert {
    return {
      ...point,
      coordinates: coordinatesToPoint(point.coordinates),
    };
  }

  // Get collection points with coordinates for map display
  static async getCollectionPointsForMap(filters?: {
    type?: string
    status?: string
    search?: string
  }): Promise<CollectionPointForMap[]> {
    const points = await this.getAllCollectionPoints(filters);
    return points.map(this.transformCollectionPointForMap);
  }
}