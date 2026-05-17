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

async function getProviderAndUser(token: string | null) {
  if (!token) return { providerId: null, userId: null };
  const supabase = makeClient(token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { providerId: null, userId: null };
  const { data: membership } = await supabase
    .from("partner_provider_users")
    .select("provider_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return { providerId: membership?.provider_id ?? null, userId: user.id };
}

// GET: list driver allocations for a request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getToken(req);
    const { providerId } = await getProviderAndUser(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    // Verify request belongs to this provider
    const { data: request } = await supabase
      .from("partner_allocation_requests")
      .select("id, service_provider_id")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (!request || request.service_provider_id !== providerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: allocations, error } = await supabase
      .from("partner_driver_allocations")
      .select("*")
      .eq("request_id", parseInt(id))
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!allocations?.length) return NextResponse.json([]);

    // Enrich with driver and vehicle info
    const driverIds = [...new Set(allocations.map((a) => a.driver_id))];
    const vehicleIds = [...new Set(allocations.map((a) => a.vehicle_id).filter(Boolean))] as number[];

    const [driversRes, vehiclesRes] = await Promise.all([
      supabase
        .from("partner_drivers")
        .select("id, full_name, phone_number, status")
        .in("id", driverIds),
      vehicleIds.length > 0
        ? supabase
            .from("partner_vehicles")
            .select("id, plate_number, vehicle_type")
            .in("id", vehicleIds)
        : Promise.resolve({ data: [] }),
    ]);

    const driverMap = Object.fromEntries(
      (driversRes.data ?? []).map((d) => [d.id, d])
    );
    const vehicleMap = Object.fromEntries(
      (vehiclesRes.data ?? []).map((v) => [v.id, v])
    );

    const enriched = allocations.map((a) => ({
      ...a,
      driver: driverMap[a.driver_id] ?? null,
      vehicle: a.vehicle_id ? vehicleMap[a.vehicle_id] ?? null : null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

// POST: assign a driver to a request
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getToken(req);
    const { providerId, userId } = await getProviderAndUser(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.driver_id) {
      return NextResponse.json({ error: "driver_id is required" }, { status: 400 });
    }

    const supabase = makeClient(token!);

    // Verify request belongs to this provider and is accepted
    const { data: request } = await supabase
      .from("partner_allocation_requests")
      .select("id, service_provider_id, status, start_date, end_date")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (!request || request.service_provider_id !== providerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!["accepted", "partially_allocated"].includes(request.status)) {
      return NextResponse.json(
        { error: "Request must be accepted before allocating drivers" },
        { status: 400 }
      );
    }

    // Verify driver belongs to this provider
    const { data: driver } = await supabase
      .from("partner_drivers")
      .select("id")
      .eq("id", body.driver_id)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

    // Verify vehicle (if provided) belongs to this provider
    if (body.vehicle_id) {
      const { data: vehicle } = await supabase
        .from("partner_vehicles")
        .select("id")
        .eq("id", body.vehicle_id)
        .eq("provider_id", providerId)
        .maybeSingle();
      if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("partner_driver_allocations")
      .insert({
        request_id: parseInt(id),
        driver_id: body.driver_id,
        vehicle_id: body.vehicle_id ?? null,
        status: "assigned",
        allocated_from: body.allocated_from ?? request.start_date,
        allocated_until: body.allocated_until ?? request.end_date,
        allocation_notes: body.allocation_notes ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update request status to partially_allocated or fully_allocated
    // (business logic: count active allocations vs drivers_requested)
    const { count } = await supabase
      .from("partner_driver_allocations")
      .select("id", { count: "exact", head: true })
      .eq("request_id", parseInt(id))
      .neq("status", "cancelled");

    const { data: reqFull } = await supabase
      .from("partner_allocation_requests")
      .select("drivers_requested")
      .eq("id", parseInt(id))
      .single();

    const newStatus =
      (count ?? 0) >= (reqFull?.drivers_requested ?? 1)
        ? "fully_allocated"
        : "partially_allocated";

    await supabase
      .from("partner_allocation_requests")
      .update({ status: newStatus })
      .eq("id", parseInt(id));

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

// DELETE: remove (cancel) a driver allocation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getToken(req);
    const { providerId } = await getProviderAndUser(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const allocationId = url.searchParams.get("allocation_id");
    if (!allocationId) {
      return NextResponse.json({ error: "allocation_id is required" }, { status: 400 });
    }

    const supabase = makeClient(token!);

    // Verify request belongs to this provider
    const { data: request } = await supabase
      .from("partner_allocation_requests")
      .select("id, service_provider_id")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (!request || request.service_provider_id !== providerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("partner_driver_allocations")
      .update({ status: "cancelled" })
      .eq("id", parseInt(allocationId))
      .eq("request_id", parseInt(id));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Recompute request status
    const { count } = await supabase
      .from("partner_driver_allocations")
      .select("id", { count: "exact", head: true })
      .eq("request_id", parseInt(id))
      .neq("status", "cancelled");

    const { data: reqFull } = await supabase
      .from("partner_allocation_requests")
      .select("drivers_requested")
      .eq("id", parseInt(id))
      .single();

    const newStatus =
      (count ?? 0) === 0
        ? "accepted"
        : (count ?? 0) >= (reqFull?.drivers_requested ?? 1)
        ? "fully_allocated"
        : "partially_allocated";

    await supabase
      .from("partner_allocation_requests")
      .update({ status: newStatus })
      .eq("id", parseInt(id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
