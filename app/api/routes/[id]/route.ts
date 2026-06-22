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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    const { data: existing } = await supabase
      .from("partner_routes")
      .select("id")
      .eq("id", routeId)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Route not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const {
      name, start_location, end_location, driver_id, status,
      total_distance, estimated_duration, efficiency_score,
      route_type, service_area, active_days,
      start_time, end_time, min_deliveries, max_deliveries,
      driver_capacity, max_orders, cutoff_time, route_name_id,
    } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (start_location !== undefined) updates.start_location = start_location;
    if (end_location !== undefined) updates.end_location = end_location;
    if (status !== undefined) updates.status = status;
    if (route_name_id !== undefined) updates.route_name_id = route_name_id;
    if (total_distance !== undefined) updates.total_distance = total_distance;
    if (estimated_duration !== undefined) updates.estimated_duration = estimated_duration;
    if (efficiency_score !== undefined) updates.efficiency_score = efficiency_score;
    if (route_type !== undefined) updates.route_type = route_type;
    if (service_area !== undefined) updates.service_area = service_area;
    if (active_days !== undefined) updates.active_days = active_days;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (min_deliveries !== undefined) updates.min_deliveries = min_deliveries;
    if (max_deliveries !== undefined) updates.max_deliveries = max_deliveries;
    if (driver_capacity !== undefined) updates.driver_capacity = driver_capacity;
    if (max_orders !== undefined) updates.max_orders = max_orders;
    if (cutoff_time !== undefined) updates.cutoff_time = cutoff_time;

    if (driver_id !== undefined) {
      if (driver_id !== null) {
        const { data: driver } = await supabase
          .from("partner_drivers")
          .select("id")
          .eq("id", driver_id)
          .eq("provider_id", providerId)
          .maybeSingle();
        if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
      }
      updates.driver_id = driver_id;
    }

    const { data, error } = await supabase
      .from("partner_routes")
      .update(updates)
      .eq("id", routeId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    const { data: existing } = await supabase
      .from("partner_routes")
      .select("id")
      .eq("id", routeId)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Route not found" }, { status: 404 });

    // Soft-delete: set is_deleted = true so all linked deliveries, drivers and
    // historical records keep their route_id and data integrity is preserved.
    const { error } = await supabase
      .from("partner_routes")
      .update({ is_deleted: true })
      .eq("id", routeId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
