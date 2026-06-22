import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { coordinatesToPoint } from "@/lib/supabase";
import { normalizeDeliveryStatuses } from "@/lib/deliveryStatusMapper";

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
    const { searchParams } = new URL(req.url);
    const routeIdParam = searchParams.get("route_id");

    if (routeIdParam) {
      const routeId = parseInt(routeIdParam, 10);

      // Verify the route belongs to this provider
      const { data: route } = await supabase
        .from("partner_routes")
        .select("id")
        .eq("id", routeId)
        .eq("provider_id", providerId)
        .maybeSingle();

      if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

      const { data, error } = await supabase
        .from("partner_deliveries")
        .select("*")
        .eq("route_id", routeId)
        .eq("is_deleted", false)
        .order("order_index", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(normalizeDeliveryStatuses(data ?? []));
    }

    // Return all deliveries for this provider
    const { data, error } = await supabase
      .from("partner_deliveries")
      .select("*")
      .eq("provider_id", providerId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(normalizeDeliveryStatuses(data ?? []));
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
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const {
      customer_name, location, coordinates, pickup_location, pickup_coordinates,
      item, phone, drop_time, route_id, route_name_id, delivery_notes, estimated_value, weight,
      status, order_index,
    } = body;

    if (!customer_name || !location || !item || !phone || !drop_time) {
      return NextResponse.json(
        { error: "customer_name, location, item, phone, and drop_time are required" },
        { status: 400 }
      );
    }

    const supabase = makeClient(token!);

    // Validate route belongs to this provider (if provided)
    if (route_id) {
      const { data: route } = await supabase
        .from("partner_routes")
        .select("id")
        .eq("id", route_id)
        .eq("provider_id", providerId)
        .maybeSingle();
      if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    // Convert coordinates [lat, lng] to PostGIS point string
    let coordsString: string | null = null;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      coordsString = coordinatesToPoint([coordinates[0], coordinates[1]]);
    } else if (typeof coordinates === "string") {
      coordsString = coordinates;
    }

    let pickupCoordsString: string | null = null;
    if (Array.isArray(pickup_coordinates) && pickup_coordinates.length >= 2) {
      pickupCoordsString = coordinatesToPoint([pickup_coordinates[0], pickup_coordinates[1]]);
    } else if (typeof pickup_coordinates === "string") {
      pickupCoordsString = pickup_coordinates;
    }

    const { data, error } = await supabase
      .from("partner_deliveries")
      .insert({
        provider_id: providerId,
        customer_name,
        pickup_location: pickup_location ?? null,
        pickup_coordinates: pickupCoordsString,
        location,
        coordinates: coordsString,
        item,
        phone,
        drop_time,
        route_id: route_id ?? null,
        route_name_id: route_name_id ?? null,
        delivery_notes: delivery_notes ?? null,
        estimated_value: estimated_value ?? null,
        weight: weight ?? null,
        status: status ?? "awaiting_approval",
        order_index: order_index ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
