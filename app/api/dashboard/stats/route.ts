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

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);
    const today = new Date().toISOString().split("T")[0];

    const [driversRes, requestsRes, allocationsRes, recentRes] = await Promise.all([
      supabase
        .from("partner_drivers")
        .select("id, status, is_online")
        .eq("provider_id", providerId),
      supabase
        .from("partner_allocation_requests")
        .select("id, status, start_date, created_at")
        .eq("service_provider_id", providerId),
      supabase
        .from("partner_driver_allocations")
        .select("id, status, driver_id, created_at")
        .in(
          "driver_id",
          (
            await supabase
              .from("partner_drivers")
              .select("id")
              .eq("provider_id", providerId)
          ).data?.map((d) => d.id) ?? []
        ),
      supabase
        .from("partner_allocation_requests")
        .select("id, status, drivers_requested, business_id, created_at, notes")
        .eq("service_provider_id", providerId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const drivers = driversRes.data ?? [];
    const requests = requestsRes.data ?? [];
    const allocations = allocationsRes.data ?? [];
    const recentRequests = recentRes.data ?? [];

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

    return NextResponse.json({
      totalDrivers,
      activeDrivers,
      allocatedDrivers,
      onRunDrivers,
      pendingRequests,
      runsToday,
      runsCompleted,
      avgCapacity,
      recentRequests,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
