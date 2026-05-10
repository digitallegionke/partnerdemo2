import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function getContext(token: string) {
  const supabase = makeClient(token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: membership } = await supabase
    .from("partner_provider_users")
    .select("provider_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!membership) return null;
  return { supabase, providerId: membership.provider_id };
}

// GET: return the currently assigned vehicle for this driver
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const driverId = parseInt(id, 10);
    if (isNaN(driverId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ctx = await getContext(token);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: assignment } = await ctx.supabase
      .from("partner_driver_vehicle_assignments")
      .select("vehicle_id")
      .eq("driver_id", driverId)
      .eq("is_active", true)
      .maybeSingle();

    if (!assignment) return NextResponse.json({ vehicle: null });

    const { data: vehicle } = await ctx.supabase
      .from("partner_vehicles")
      .select("*")
      .eq("id", assignment.vehicle_id)
      .maybeSingle();

    return NextResponse.json({ vehicle: vehicle ?? null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

// POST: assign (vehicle_id) or unassign (vehicle_id: null)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const driverId = parseInt(id, 10);
    if (isNaN(driverId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ctx = await getContext(token);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { vehicle_id } = body;

    // Verify driver belongs to this provider
    const { data: driver } = await ctx.supabase
      .from("partner_drivers")
      .select("id, status")
      .eq("id", driverId)
      .eq("provider_id", ctx.providerId)
      .maybeSingle();

    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

    // Deactivate any existing assignment for this driver and free their current vehicle
    const { data: existing } = await ctx.supabase
      .from("partner_driver_vehicle_assignments")
      .select("id, vehicle_id")
      .eq("driver_id", driverId)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      await ctx.supabase
        .from("partner_driver_vehicle_assignments")
        .update({ is_active: false, assigned_to: new Date().toISOString() })
        .eq("id", existing.id);

      await ctx.supabase
        .from("partner_vehicles")
        .update({ status: "available", assigned_driver_id: null, updated_at: new Date().toISOString() })
        .eq("id", existing.vehicle_id);
    }

    if (!vehicle_id) {
      // Unassign: set driver back to active
      const { data: updated } = await ctx.supabase
        .from("partner_drivers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", driverId)
        .select()
        .single();
      return NextResponse.json({ ...updated, assigned_vehicle: null });
    }

    // Assign: verify vehicle belongs to provider and is available
    const { data: vehicle } = await ctx.supabase
      .from("partner_vehicles")
      .select("id, status, provider_id, plate_number, vehicle_type")
      .eq("id", vehicle_id)
      .maybeSingle();

    if (!vehicle || vehicle.provider_id !== ctx.providerId) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    if (vehicle.status !== "available") {
      return NextResponse.json({ error: "Vehicle is not available" }, { status: 400 });
    }

    await ctx.supabase
      .from("partner_driver_vehicle_assignments")
      .insert({ driver_id: driverId, vehicle_id, is_active: true });

    await ctx.supabase
      .from("partner_vehicles")
      .update({ status: "assigned", assigned_driver_id: driverId, updated_at: new Date().toISOString() })
      .eq("id", vehicle_id);

    const { data: updated } = await ctx.supabase
      .from("partner_drivers")
      .update({ status: "on_trip", updated_at: new Date().toISOString() })
      .eq("id", driverId)
      .select()
      .single();

    return NextResponse.json({
      ...updated,
      assigned_vehicle: { plate_number: vehicle.plate_number, vehicle_type: vehicle.vehicle_type },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
