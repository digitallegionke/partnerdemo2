import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeClient(authToken?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(authToken && {
        global: { headers: { Authorization: `Bearer ${authToken}` } },
      }),
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

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

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
    if (!providerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = makeClient(token!);
    const { data: drivers, error } = await supabase
      .from("partner_drivers")
      .select("*")
      .eq("provider_id", providerId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!drivers?.length) return NextResponse.json([]);

    // Fetch active assignments for these drivers
    const driverIds = drivers.map((d) => d.id);
    const { data: assignments } = await supabase
      .from("partner_driver_vehicle_assignments")
      .select("driver_id, vehicle_id, assigned_from")
      .in("driver_id", driverIds)
      .eq("is_active", true);

    const assignmentMap = Object.fromEntries(
      (assignments ?? []).map((a) => [a.driver_id, { vehicle_id: a.vehicle_id, assigned_from: a.assigned_from }])
    );

    const vehicleIds = [...new Set((assignments ?? []).map((a) => a.vehicle_id))];
    let vehicleMap: Record<number, { plate_number: string; vehicle_type: string }> = {};

    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from("partner_vehicles")
        .select("id, plate_number, vehicle_type")
        .in("id", vehicleIds);
      vehicleMap = Object.fromEntries(
        (vehicles ?? []).map((v) => [v.id, { plate_number: v.plate_number, vehicle_type: v.vehicle_type }])
      );
    }

    const enriched = drivers.map((d) => {
      const asgn = assignmentMap[d.id];
      if (!asgn) return { ...d, assigned_vehicle: null };
      const veh = vehicleMap[asgn.vehicle_id];
      return {
        ...d,
        assigned_vehicle: veh
          ? { plate_number: veh.plate_number, vehicle_type: veh.vehicle_type, assigned_from: asgn.assigned_from }
          : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { full_name, phone_number, email, license_type, license_number,
            license_expiry, primary_zone, is_active, availability } = body;
    if (!full_name || !phone_number || !email) {
      return NextResponse.json(
        { error: "full_name, phone_number, and email are required" },
        { status: 400 }
      );
    }

    const supabase = makeClient(token!);
    const { data, error } = await supabase
      .from("partner_drivers")
      .insert({
        full_name,
        phone_number,
        email,
        license_type:   license_type   ?? "",
        license_number: license_number ?? "",
        license_expiry:  license_expiry  ?? null,
        primary_zone:    primary_zone    ?? null,
        is_active:       is_active !== undefined ? Boolean(is_active) : true,
        availability:    availability    ?? "available",
        provider_id: providerId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
