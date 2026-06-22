import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeClient(authToken?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(authToken && { global: { headers: { Authorization: `Bearer ${authToken}` } } }),
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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
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
    const { data: routes, error } = await supabase
      .from("partner_routes")
      .select("*")
      .eq("provider_id", providerId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!routes?.length) return NextResponse.json([]);

    // Enrich with partner driver names
    const driverIds = [...new Set(routes.map((r) => r.driver_id).filter(Boolean))] as number[];
    let driverMap: Record<number, string> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from("partner_drivers")
        .select("id, full_name")
        .in("id", driverIds);
      driverMap = Object.fromEntries((drivers ?? []).map((d) => [d.id, d.full_name]));
    }

    // Count partner_deliveries per route
    const routeIds = routes.map((r) => r.id);
    const { data: deliveries } = await supabase
      .from("partner_deliveries")
      .select("id, route_id")
      .in("route_id", routeIds);

    const deliveryCounts: Record<number, number> = {};
    (deliveries ?? []).forEach((d) => {
      if (d.route_id) deliveryCounts[d.route_id] = (deliveryCounts[d.route_id] || 0) + 1;
    });

    const enriched = routes.map((r) => ({
      ...r,
      driver: r.driver_id ? { id: r.driver_id, name: driverMap[r.driver_id] ?? "Unknown" } : null,
      delivery_count: deliveryCounts[r.id] || 0,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const {
      name, start_location, end_location, driver_id, status, lat, lng,
      route_type, service_area, active_days, start_time, end_time,
      min_deliveries, max_deliveries, driver_capacity, max_orders, cutoff_time,
      route_name_id, delivery_stops,
    } = body;

    const supabase = makeClient(token!);

    // Validate driver belongs to this provider
    if (driver_id) {
      const { data: driver } = await supabase
        .from("partner_drivers")
        .select("id")
        .eq("id", driver_id)
        .eq("provider_id", providerId)
        .maybeSingle();
      if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("partner_routes")
      .insert({
        provider_id: providerId,
        name: name.trim(),
        start_location: start_location ?? null,
        end_location: end_location ?? null,
        driver_id: driver_id ?? null,
        route_name_id: route_name_id ?? null,
        status: status ?? "pending",
        lat: lat ?? "0",
        lng: lng ?? "0",
        route_type: route_type ?? "on_demand",
        service_area: service_area ?? null,
        active_days: active_days ?? ["Mon","Tue","Wed","Thu","Fri"],
        start_time: start_time ?? "08:00",
        end_time: end_time ?? "18:00",
        min_deliveries: min_deliveries ?? 0,
        max_deliveries: max_deliveries ?? null,
        driver_capacity: driver_capacity ?? null,
        max_orders: max_orders ?? null,
        cutoff_time: cutoff_time ?? null,
        delivery_stops: delivery_stops ?? [],
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
