import {
  coordinatesToPoint,
  parsePointCoordinates,
} from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
type DeliveryInsert = Database["public"]["Tables"]["deliveries"]["Insert"];
type DeliveryUpdate = Database["public"]["Tables"]["deliveries"]["Update"];

// Delivery type for the frontend with coordinates as array
export interface DeliveryForMap {
  id: number;
  route_id: number | null;
  customer_name: string;
  location: string;
  coordinates: [number, number]; // [lat, lng]
  item: string;
  estimatedValue?: string | null;
  weight?: string | null;
  phone: string;
  drop_time: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  order_index?: number | null;
}

export class DeliveryService {
  private static baseUrl = '/api/deliveries'
  
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

    const result = await response.json()

    if (!response.ok) {
      console.error('API Error Response:', result)
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return result
  }

  static async getAllDeliveries(): Promise<Delivery[]> {
    try {
      const data = await this.fetchWithAuth(this.baseUrl, { method: 'GET' })
      return data || []
    } catch (error) {
      console.error('Error fetching deliveries:', error)
      throw error
    }
  }

  static async getDeliveryById(id: number): Promise<Delivery | null> {
    try {
      const data = await this.fetchWithAuth(`${this.baseUrl}/${id}`, { method: 'GET' })
      return data
    } catch (error) {
      console.error('Error fetching delivery by id:', error)
      throw error
    }
  }

  static async getDeliveriesByRoute(
    routeId: number
  ): Promise<DeliveryForMap[]> {
    try {
      const allDeliveries = await this.getAllDeliveries();
      const routeDeliveries = allDeliveries.filter(
        (delivery) => delivery.route_id === routeId
      );
      
      // Transform to DeliveryForMap format
      return routeDeliveries.map((delivery) => {
        const [lat, lng] = parsePointCoordinates(delivery.coordinates);
        return {
          id: delivery.id,
          route_id: delivery.route_id,
          customer_name: delivery.customer_name,
          location: delivery.location,
          coordinates: [lat, lng] as [number, number],
          item: delivery.item,
          estimatedValue: delivery.estimated_value,
          weight: delivery.weight,
          phone: delivery.phone,
          drop_time: delivery.drop_time,
          status: delivery.status as "pending" | "in-progress" | "completed" | "failed",
          order_index: delivery.order_index,
        };
      });
    } catch (error) {
      console.error(`Error fetching deliveries for route ${routeId}:`, error);
      return [];
    }
  }

  static async getDeliveriesByStatus(
    status: "pending" | "in-progress" | "completed" | "failed"
  ): Promise<Delivery[]> {
    return []
  }

  static async getAssignedDeliveryDriver(assignedTo: number) {
    return "Unassigned"
  }

  static async createDelivery(delivery: {
    customer_name: string;
    location: string;
    coordinates: [number, number]; 
    item: string;
    estimated_value?: string | null;
    weight?: string | null;
    phone: string;
    drop_time: string;
    status?: string;
    delivery_notes?: string;
  }): Promise<Delivery> {
    try {
      const data = await this.fetchWithAuth(this.baseUrl, {
        method: 'POST',
        body: JSON.stringify(delivery),
      })
      return data
    } catch (error) {
      console.error('Error creating delivery:', error)
      throw error
    }
  }

  static async updateDelivery(
    id: number,
    updates: DeliveryUpdate
  ): Promise<Delivery> {
    try {
      const data = await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      return data
    } catch (error) {
      console.error('Error updating delivery:', error)
      throw error
    }
  }

  static async updateDeliveryStatus(
    id: number,
    status: "pending" | "in-progress" | "completed" | "failed"
  ): Promise<Delivery> {
    return this.updateDelivery(id, { status });
  }

  static async updateDeliveryOrder(
    deliveries: Array<{ id: number; order_index: number }>
  ): Promise<void> {
    await Promise.all(
      deliveries.map((d) =>
        this.updateDelivery(d.id, { order_index: d.order_index })
      )
    )
  }

  static async deleteDelivery(id: number): Promise<void> {
    try {
      await this.fetchWithAuth(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      })
      return
    } catch (error) {
      console.error('Error deleting delivery:', error)
      throw error
    }
  }

  static async getDeliveryStats() {
    try {
      const deliveries = await this.getAllDeliveries();
      
      const stats = {
        total: deliveries.length,
        pending: deliveries.filter(d => d.status === 'pending').length,
        inProgress: deliveries.filter(d => d.status === 'in-progress').length,
        completed: deliveries.filter(d => d.status === 'completed').length,
        failed: deliveries.filter(d => d.status === 'failed').length,
        totalValue: deliveries.reduce((sum, d) => {
          const value = parseInt(d.estimated_value?.toString().replace(/[^\d]/g, '') || '0', 10);
          return sum + value;
        }, 0),
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting delivery stats:', error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        totalValue: 0,
      };
    }
  }

  // Transform database delivery to frontend format
  static transformDeliveryForMap(delivery: Delivery): DeliveryForMap {
    // Parse coordinates from PostgreSQL POINT format to array
    const coordinates = parsePointCoordinates(delivery.coordinates);

    return {
      id: delivery.id,
      route_id: delivery.route_id,
      customer_name: delivery.customer_name,
      location: delivery.location,
      coordinates,
      item: delivery.item,
      estimatedValue: delivery.estimated_value,
      weight: delivery.weight,
      phone: delivery.phone,
      drop_time: delivery.drop_time,
      status: delivery.status,
      order_index: delivery.order_index,
    };
  }

  // Transform frontend delivery to database format
  static transformDeliveryForDB(delivery: DeliveryForMap): DeliveryInsert {
    return {
      route_id: delivery.route_id,
      customer_name: delivery.customer_name,
      location: delivery.location,
      coordinates: coordinatesToPoint(delivery.coordinates),
      item: delivery.item,
      estimated_value: delivery.estimatedValue,
      weight: delivery.weight,
      phone: delivery.phone,
      drop_time: delivery.drop_time,
      status: delivery.status,
      order_index: delivery.order_index,
    };
  }

  static async getTodaysDeliveries(): Promise<Delivery[]> {
    return []
  }

  static async searchDeliveries(query: string): Promise<Delivery[]> {
    return []
  }

  /**
   * Fetch unassigned deliveries, optionally scored/ranked for a specific route.
   */
  static async getUnassignedDeliveries(
    routeId?: number,
    maxDetourKm?: number
  ): Promise<any[]> {
    const params = new URLSearchParams()
    if (routeId) params.set('route_id', String(routeId))
    if (maxDetourKm) params.set('max_detour_km', String(maxDetourKm))
    const result = await this.fetchWithAuth(
      `/api/deliveries/unassigned?${params.toString()}`,
      { method: 'GET' }
    )
    return result.deliveries || []
  }

  /**
   * Assign deliveries to a route.
   */
  static async assignToRoute(
    deliveryIds: number[],
    routeId: number
  ): Promise<{ assigned: number; total_requested: number }> {
    return this.fetchWithAuth('/api/deliveries/assign-to-route', {
      method: 'POST',
      body: JSON.stringify({ delivery_ids: deliveryIds, route_id: routeId }),
    })
  }

  // Calendar-specific methods for delivery scheduling
  static async getDeliveriesForCalendar(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: number;
    title: string;
    start: Date;
    end: Date;
    status: "pending" | "in-progress" | "completed" | "failed";
    location: string;
    customer_name: string;
    item: string;
    phone: string;
    estimated_value?: string | null;
    weight?: string | null;
    notes?: string;
  }>> {
    return []
  }

  static async createDeliveryForCalendar(delivery: {
    customer_name: string;
    location: string;
    item: string;
    estimated_value?: string | null;
    weight?: string | null;
    phone: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    notes?: string;
    status?: string;
  }): Promise<Delivery> {
    // Convert calendar format to delivery format
    const drop_time = `${delivery.scheduled_date}T${delivery.start_time}`;
    const deliveryData = {
      customer_name: delivery.customer_name,
      location: delivery.location,
      coordinates: [0, 0] as [number, number], // Default coordinates - should be geocoded
      item: delivery.item,
      estimated_value: delivery.estimated_value,
      weight: delivery.weight,
      phone: delivery.phone,
      drop_time,
      status: delivery.status || 'pending',
      delivery_notes: delivery.notes,
    };
    return this.createDelivery(deliveryData);
  }

  static async approveDelivery(
    id: number,
    routeId?: number
  ): Promise<Delivery> {
    throw new Error("Approve delivery not yet implemented via API")
  }

  static async rejectDelivery(id: number, reason?: string): Promise<Delivery> {
    throw new Error("Reject delivery not yet implemented via API")
  }
}