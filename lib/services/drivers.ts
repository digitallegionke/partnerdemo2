import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type DriverInsert = Database["public"]["Tables"]["drivers"]["Insert"];
type DriverUpdate = Database["public"]["Tables"]["drivers"]["Update"];

export class DriverService {
  static async getAllDrivers(): Promise<Driver[]> {
    const { data, error } = await supabase
      .from("drivers")
      .select(
        `
      *,
      deliveries:deliveries(count)
    `
      )
      .order("name");

    if (error) {
      console.error("Error fetching drivers:", error);
      throw error;
    }

    return data || [];
  }

  static async getDriverById(id: number): Promise<Driver | null> {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error fetching driver:", error);
      throw error;
    }

    return data;
  }

  static async getActiveDrivers(): Promise<Driver[]> {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("status", "active")
      .order("name");

    if (error) {
      console.error("Error fetching active drivers:", error);
      throw error;
    }

    return data || [];
  }

  static async createDriver(driver: DriverInsert): Promise<Driver> {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("Failed to get user", userErr);
      throw userErr;
    }
    if (!user) throw new Error("Not authenticated");

    const { data: membership, error: memErr } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (memErr) {
      console.error("Failed to fetch memberships", memErr);
      throw memErr;
    }

    if (!membership || !membership?.organization_id) {
      throw new Error("User is not a member of any organization");
    }

    const { data, error } = await supabase
      .from("drivers")
      .insert([{ ...driver, org_id: membership.organization_id }])
      .select()
      .single();

    if (error) {
      console.error("Error creating driver:", error);
      throw error;
    }

    return data;
  }

  static async updateDriver(
    id: number,
    updates: DriverUpdate
  ): Promise<Driver> {
    const { data, error } = await supabase
      .from("drivers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating driver:", error);
      throw error;
    }

    return data;
  }

  static async updateDriverStatus(
    id: number,
    status: "active" | "inactive" | "on_break"
  ): Promise<Driver> {
    return this.updateDriver(id, { status });
  }

  static async deleteDriver(id: number): Promise<void> {
    const { error } = await supabase.from("drivers").delete().eq("id", id);

    if (error) {
      console.error("Error deleting driver:", error);
      throw error;
    }
  }

  static async getDriverStats() {
    const { data, error } = await supabase.from("drivers").select("status");

    if (error) {
      console.error("Error fetching driver stats:", error);
      throw error;
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter((d) => d.status === "active").length || 0,
      inactive: data?.filter((d) => d.status === "inactive").length || 0,
      on_break: data?.filter((d) => d.status === "on_break").length || 0,
    };

    return stats;
  }
}
