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
    const { data: vehicles, error } = await supabase
      .from("partner_vehicles")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!vehicles?.length) return NextResponse.json([]);

    // Enrich with assigned driver name
    const driverIds = [...new Set(vehicles.map((v) => v.assigned_driver_id).filter(Boolean))] as number[];
    let driverMap: Record<number, string> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from("partner_drivers")
        .select("id, full_name")
        .in("id", driverIds);
      driverMap = Object.fromEntries((drivers ?? []).map((d) => [d.id, d.full_name]));
    }

    const enriched = vehicles.map((v) => ({
      ...v,
      assigned_driver_name: v.assigned_driver_id ? (driverMap[v.assigned_driver_id] ?? null) : null,
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
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    const {
      plate_number, vehicle_type, capacity_kg, make, model, year, color,
      vin, fuel_type, odometer_km, allowed_license, last_service_date, notes,
      availability, is_active, insurance_expiry, inspection_expiry,
    } = body;
    if (!plate_number || !vehicle_type) {
      return NextResponse.json({ error: "plate_number and vehicle_type are required" }, { status: 400 });
    }

    const supabase = makeClient(token!);
    const { data, error } = await supabase
      .from("partner_vehicles")
      .insert({
        provider_id: providerId,
        plate_number: plate_number.toUpperCase().trim(),
        vehicle_type,
        capacity_kg:       capacity_kg       ?? null,
        make:              make              ?? null,
        model:             model             ?? null,
        year:              year              ?? null,
        color:             color             ?? null,
        vin:               vin               ?? null,
        fuel_type:         fuel_type         ?? null,
        odometer_km:       odometer_km       ?? null,
        allowed_license:   allowed_license   ?? null,
        last_service_date: last_service_date ?? null,
        insurance_expiry:  insurance_expiry  ?? null,
        inspection_expiry: inspection_expiry ?? null,
        availability:      availability      ?? "available",
        is_active:         is_active !== undefined ? Boolean(is_active) : true,
        notes:             notes             ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
