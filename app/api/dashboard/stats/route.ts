import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeClient(token?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(token && { global: { headers: { Authorization: `Bearer ${token}` } } }),
    }
  );
}

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function getProviderId(token: string | null) {
  if (!token) return null;
  const supabase = makeClient(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("partner_provider_users")
    .select("provider_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return membership?.provider_id ?? null;
}

const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "received",
  accepted: "approved",
  partially_allocated: "partially allocated",
  fully_allocated: "fully allocated",
  completed: "completed",
  rejected: "rejected",
  cancelled: "cancelled",
};

export type ActivityType = "request" | "delivery" | "driver" | "route" | "vehicle" | "client";

export interface ActivityItem {
  key: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  status: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);
    const today = new Date().toISOString().split("T")[0];

    // Pre-fetch driver IDs so the allocations query can run in parallel with everything else
    const { data: driverIdRows } = await supabase
      .from("partner_drivers")
      .select("id")
      .eq("provider_id", providerId);
    const driverIds = driverIdRows?.map((d) => d.id) ?? [];

    const [
      driversRes,
      requestsRes,
      allocationsRes,
      recentRequestsRes,
      recentDeliveriesRes,
      recentDriversRes,
      recentRoutesRes,
      recentVehiclesRes,
      recentClientsRes,
    ] = await Promise.all([
      supabase.from("partner_drivers").select("id, status, is_online").eq("provider_id", providerId),
      supabase.from("partner_allocation_requests").select("id, status, start_date, created_at").eq("service_provider_id", providerId),
      supabase.from("partner_driver_allocations").select("id, status, driver_id, created_at").in("driver_id", driverIds),
      supabase.from("partner_allocation_requests").select("id, status, drivers_requested, business_id, created_at, notes").eq("service_provider_id", providerId).order("created_at", { ascending: false }).limit(5),
      supabase.from("partner_deliveries").select("id, customer_name, status, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(5),
      supabase.from("partner_drivers").select("id, full_name, status, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(5),
      supabase.from("partner_routes").select("id, name, status, route_type, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(5),
      supabase.from("partner_vehicles").select("id, plate_number, vehicle_type, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(5),
      supabase.from("partner_clients").select("id, company_name, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(5),
    ]);

    const drivers = driversRes.data ?? [];
    const requests = requestsRes.data ?? [];
    const allocations = allocationsRes.data ?? [];

    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter((d) => d.status === "active").length;
    const onTripDrivers = drivers.filter((d) => d.status === "on_trip").length;

    const activeAllocations = allocations.filter((a) =>
      ["assigned", "accepted", "in_progress"].includes(a.status)
    );
    const allocatedDrivers = new Set(activeAllocations.map((a) => a.driver_id)).size;
    const onRunDrivers = allocations.filter((a) => a.status === "in_progress").length;

    const pendingRequests = requests.filter((r) => r.status === "pending").length;
    const runsToday = requests.filter((r) => r.start_date === today || r.created_at?.startsWith(today)).length;
    const runsCompleted = requests.filter((r) => r.status === "completed").length;

    const avgCapacity =
      totalDrivers > 0
        ? Math.round(((activeDrivers + onTripDrivers) / totalDrivers) * 100)
        : 0;

    // Build unified activity feed from all entity tables
    const activityItems: ActivityItem[] = [
      ...(recentRequestsRes.data ?? []).map((r) => ({
        key: `request-${r.id}`,
        type: "request" as ActivityType,
        title: `ARQ-${String(r.id).padStart(4, "0")} ${REQUEST_STATUS_LABEL[r.status] ?? r.status}`,
        subtitle: `${r.drivers_requested} driver${r.drivers_requested !== 1 ? "s" : ""} requested${r.notes ? ` • ${r.notes}` : ""}`,
        status: r.status,
        created_at: r.created_at,
      })),
      ...(recentDeliveriesRes.data ?? []).map((d) => ({
        key: `delivery-${d.id}`,
        type: "delivery" as ActivityType,
        title: `Delivery for ${d.customer_name ?? "Unknown"}`,
        subtitle: (d.status ?? "").replace(/_/g, " "),
        status: d.status ?? "unknown",
        created_at: d.created_at,
      })),
      ...(recentDriversRes.data ?? []).map((d) => ({
        key: `driver-${d.id}`,
        type: "driver" as ActivityType,
        title: `Driver ${d.full_name ?? "Unknown"} registered`,
        subtitle: d.status ?? "active",
        status: d.status ?? "active",
        created_at: d.created_at,
      })),
      ...(recentRoutesRes.data ?? []).map((r) => ({
        key: `route-${r.id}`,
        type: "route" as ActivityType,
        title: `Route "${r.name}" created`,
        subtitle: `${r.route_type === "on_demand" ? "On-demand" : "Planned"} • ${r.status}`,
        status: r.status ?? "pending",
        created_at: r.created_at,
      })),
      ...(recentVehiclesRes.data ?? []).map((v) => ({
        key: `vehicle-${v.id}`,
        type: "vehicle" as ActivityType,
        title: `Vehicle ${v.plate_number} added`,
        subtitle: v.vehicle_type ?? "Fleet vehicle",
        status: "active",
        created_at: v.created_at,
      })),
      ...(recentClientsRes.data ?? []).map((c) => ({
        key: `client-${c.id}`,
        type: "client" as ActivityType,
        title: `Client ${c.company_name ?? "Unknown"} added`,
        subtitle: "New client onboarded",
        status: "active",
        created_at: c.created_at,
      })),
    ];

    activityItems.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const recentActivity = activityItems.slice(0, 10);

    return NextResponse.json({
      totalDrivers,
      activeDrivers,
      allocatedDrivers,
      onRunDrivers,
      pendingRequests,
      runsToday,
      runsCompleted,
      avgCapacity,
      recentActivity,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
