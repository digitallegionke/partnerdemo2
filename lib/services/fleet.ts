import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

export type FleetVehicle = Database["public"]["Tables"]["partner_vehicles"]["Row"];
export type FleetInsert  = Omit<Database["public"]["Tables"]["partner_vehicles"]["Insert"], "provider_id">;
export type FleetUpdate  = Database["public"]["Tables"]["partner_vehicles"]["Update"];

export class FleetService {
  private static baseUrl = "/api/fleet";

  private static async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : "";
  }

  private static async fetchWithAuth(url: string, options: RequestInit = {}) {
    const authHeader = await this.getAuthHeader();
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: authHeader, ...options.headers },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }

  static async getAll(): Promise<FleetVehicle[]> {
    return this.fetchWithAuth(this.baseUrl, { method: "GET" });
  }

  static async create(vehicle: FleetInsert): Promise<FleetVehicle> {
    return this.fetchWithAuth(this.baseUrl, { method: "POST", body: JSON.stringify(vehicle) });
  }

  static async update(id: number, updates: FleetUpdate): Promise<FleetVehicle> {
    return this.fetchWithAuth(`${this.baseUrl}/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
  }

  static async delete(id: number): Promise<void> {
    await this.fetchWithAuth(`${this.baseUrl}/${id}`, { method: "DELETE" });
  }
}
