import {
  supabase,
  coordinatesToPoint,
  parsePointCoordinates,
} from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { DriverService } from "./drivers";

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
    const { data, error } = await supabase
      .from("deliveries")

      .select(
        `
      *,
      driver:drivers (
        id,
        name,
        phone,
        vehicle_type
      )
    `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deliveries:", error);
      throw error;
    }

    return data || [];
  }

  static async getDeliveryById(id: number): Promise<Delivery | null> {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching delivery:", error);
      throw error;
    }

    return data;
  }

  static async getDeliveriesByRoute(
    routeId: number
  ): Promise<DeliveryForMap[]> {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("route_id", routeId)
      .order("order_index");

    if (error) {
      console.error("Error fetching deliveries by route:", error);
      throw error;
    }

    // Transform the data to match frontend expectations
    return (data || []).map(this.transformDeliveryForMap);
  }

  static async getDeliveriesByStatus(
    status: "pending" | "in-progress" | "completed" | "failed"
  ): Promise<Delivery[]> {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("status", status)
      .order("drop_time");

    if (error) {
      console.error("Error fetching deliveries by status:", error);
      throw error;
    }

    return data || [];
  }

  static async getAssignedDeliveryDriver(assignedTo: number) {
    const drivers = await DriverService.getAllDrivers();
    const driver = drivers.find((d) => d.id === assignedTo);
    return driver?.name || "Unassigned";
  }

  static async createDelivery(delivery: {
    customer_name: string;
    location: string;
    coordinates: [number, number]; // [lat, lng]
    item: string;
    estimated_value?: string | null;
    weight?: string | null;
    phone: string;
    drop_time: string;
    status?: string;
    delivery_notes?: string;
  }): Promise<Delivery> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw userError || new Error("User not authenticated");

      // 2. Get profile.id (used for created_by)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (profileError || !profile)
        throw profileError || new Error("Profile not found");

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (membershipError || !membership)
        throw membershipError || new Error("Organization membership not found");

      // Convert coordinates to PostGIS geometry object
      const [lat, lng] = delivery.coordinates;
      const deliveryData = {
        ...delivery,
        organization_id: membership.organization_id,
        created_by: profile.id,
        updated_by: profile.id,
        coordinates: `(${lng}, ${lat})`,
        status: "pending",
      };

      const { data, error } = await supabase
        .from("deliveries")
        .insert([deliveryData])
        .select()
        .single();

      if (error) {
        console.error("Error creating delivery:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in createDelivery:", error);
      throw error;
    }
  }

  static async updateDelivery(
    id: number,
    updates: DeliveryUpdate
  ): Promise<Delivery> {
    const { data, error } = await supabase
      .from("deliveries")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating delivery:", error);
      throw error;
    }

    return data;
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
    const updates = deliveries.map((delivery) =>
      supabase
        .from("deliveries")
        .update({ order_index: delivery.order_index })
        .eq("id", delivery.id)
    );

    const results = await Promise.all(updates);

    for (const result of results) {
      if (result.error) {
        console.error("Error updating delivery order:", result.error);
        throw result.error;
      }
    }
  }

  static async deleteDelivery(id: number): Promise<void> {
    const { error } = await supabase.from("deliveries").delete().eq("id", id);

    if (error) {
      console.error("Error deleting delivery:", error);
      throw error;
    }
  }

  static async getDeliveryStats() {
    const { data, error } = await supabase
      .from("deliveries")
      .select("status, estimated_value");

    if (error) {
      console.error("Error fetching delivery stats:", error);
      throw error;
    }

    const stats = {
      total: data?.length || 0,
      pending: data?.filter((d) => d.status === "pending").length || 0,
      inProgress: data?.filter((d) => d.status === "in-progress").length || 0,
      completed: data?.filter((d) => d.status === "completed").length || 0,
      failed: data?.filter((d) => d.status === "failed").length || 0,
      totalValue:
        data?.reduce((sum, d) => {
          const value = d.estimated_value?.replace(/[^0-9]/g, "") || "0";
          return sum + parseInt(value);
        }, 0) || 0,
    };

    return stats;
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
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`)
      .order("drop_time");

    if (error) {
      console.error("Error fetching today's deliveries:", error);
      throw error;
    }

    return data || [];
  }

  static async searchDeliveries(query: string): Promise<Delivery[]> {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .or(
        `customer_name.ilike.%${query}%, location.ilike.%${query}%, item.ilike.%${query}%`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error searching deliveries:", error);
      throw error;
    }

    return data || [];
  }

  // Calendar-specific methods for delivery scheduling
  static async createDeliveryForCalendar(delivery: {
    customer_name: string;
    location: string;
    coordinates?: [number, number]; // [lat, lng] - optional for now
    item: string;
    estimated_value?: string | null;
    weight?: string | null;
    phone: string;
    scheduled_date: string; // YYYY-MM-DD format
    start_time: string; // HH:MM format
    end_time: string; // HH:MM format
    notes?: string;
    status?: "pending" | "in-progress" | "completed" | "failed";
  }): Promise<Delivery> {
    try {
      // Default coordinates to Nairobi if not provided
      const defaultCoordinates: [number, number] = [-1.2921, 36.8219]; // Nairobi city center
      const coords = delivery.coordinates || defaultCoordinates;

      const deliveryData = {
        customer_name: delivery.customer_name,
        location: delivery.location,
        coordinates: {
          type: "Point",
          coordinates: [coords[1], coords[0]], // GeoJSON format: [longitude, latitude]
        },
        item: delivery.item,
        estimated_value: delivery.estimated_value,
        weight: delivery.weight,
        phone: delivery.phone,
        drop_time: delivery.start_time, // Use start_time as drop_time for now
        status: delivery.status || "pending",
      };

      const { data, error } = await supabase
        .from("deliveries")
        .insert([deliveryData])
        .select()
        .single();

      if (error) {
        console.error("Error creating calendar delivery:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in createDeliveryForCalendar:", error);
      throw error;
    }
  }

  static async getDeliveriesForCalendar(
    startDate?: string,
    endDate?: string
  ): Promise<
    Array<{
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
    }>
  > {
    try {
      let query = supabase
        .from("deliveries")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by date range if provided
      if (startDate && endDate) {
        query = query
          .gte("created_at", `${startDate}T00:00:00`)
          .lte("created_at", `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching calendar deliveries:", error);
        throw error;
      }

      // Transform to calendar format
      return (data || []).map((delivery) => {
        // Parse the date - for now, use created_at date + drop_time
        const deliveryDate = new Date(delivery.created_at);
        const [hours, minutes] = delivery.drop_time.split(":");

        const start = new Date(deliveryDate);
        start.setHours(parseInt(hours), parseInt(minutes), 0);

        const end = new Date(start);
        end.setHours(start.getHours() + 1); // Default 1 hour duration

        return {
          id: delivery.id,
          title: `${delivery.customer_name} - ${delivery.item}`,
          start,
          end,
          status: delivery.status,
          location: delivery.location,
          customer_name: delivery.customer_name,
          item: delivery.item,
          phone: delivery.phone,
          estimated_value: delivery.estimated_value,
          weight: delivery.weight,
          notes: undefined,
        };
      });
    } catch (error) {
      console.error("Error in getDeliveriesForCalendar:", error);
      throw error;
    }
  }

  static async approveDelivery(
    id: number,
    routeId?: number
  ): Promise<Delivery> {
    try {
      // Import RouteService here to avoid circular dependency
      const { RouteService } = await import("./routes");

      // Use the route service to properly assign delivery to route
      await RouteService.addDeliveryToRoute(id, routeId);

      // Fetch and return the updated delivery
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching approved delivery:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in approveDelivery:", error);
      throw error;
    }
  }

  static async rejectDelivery(id: number, reason?: string): Promise<Delivery> {
    try {
      const updates: any = { status: "failed" };

      // Store rejection reason if available
      if (reason) {
        updates.notes = reason;
      }

      const { data, error } = await supabase
        .from("deliveries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error rejecting delivery:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in rejectDelivery:", error);
      throw error;
    }
  }
}
