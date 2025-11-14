import {
  coordinatesToPoint,
  parsePointCoordinates,
} from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

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
  static async getAllDeliveries(): Promise<Delivery[]> {
    try {
      const response = await fetch('/api/deliveries', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // sends cookies with request
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data || []
    } catch (error) {
      console.error('Error fetching deliveries:', error)
      throw error
    }
  }

  static async getDeliveryById(id: number): Promise<Delivery | null> {
    try {
      const response = await fetch(`/api/deliveries/${id}` , {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (response.status === 404) return null
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch delivery ${id}`)
      }
      const data = await response.json()
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
      const response = await fetch('/api/deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(delivery),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create delivery')
      }

      const data = await response.json()
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
      const response = await fetch(`/api/deliveries/${id}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update delivery ${id}`)
      }
      const data = await response.json()
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
    throw new Error("Update order not yet implemented via API")
  }

  static async deleteDelivery(id: number): Promise<void> {
    try {
      const response = await fetch(`/api/deliveries/${id}` , {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to delete delivery ${id}`)
      }
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