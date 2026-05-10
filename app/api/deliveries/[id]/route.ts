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

async function getDeliveryAndVerifyOwnership(
  supabase: ReturnType<typeof makeClient>,
  deliveryId: number,
  providerId: number
) {
  const { data: delivery } = await supabase
    .from("partner_deliveries")
    .select("id, route_id, provider_id")
    .eq("id", deliveryId)
    .eq("provider_id", providerId)
    .maybeSingle();

  return delivery ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    const delivery = await getDeliveryAndVerifyOwnership(supabase, deliveryId, providerId);
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const {
      route_id, status, order_index, customer_name, location,
      item, phone, drop_time, estimated_value, weight, delivery_notes,
    } = body;

    const updates: any = {};
    if (route_id !== undefined) updates.route_id = route_id;
    if (status !== undefined) updates.status = status;
    if (order_index !== undefined) updates.order_index = order_index;
    if (customer_name !== undefined) updates.customer_name = customer_name;
    if (location !== undefined) updates.location = location;
    if (item !== undefined) updates.item = item;
    if (phone !== undefined) updates.phone = phone;
    if (drop_time !== undefined) updates.drop_time = drop_time;
    if (estimated_value !== undefined) updates.estimated_value = estimated_value;
    if (weight !== undefined) updates.weight = weight;
    if (delivery_notes !== undefined) updates.delivery_notes = delivery_notes;

    // If assigning to a route, verify it belongs to this provider
    if (route_id != null) {
      const { data: route } = await supabase
        .from("partner_routes")
        .select("id")
        .eq("id", route_id)
        .eq("provider_id", providerId)
        .maybeSingle();
      if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("partner_deliveries")
      .update(updates)
      .eq("id", deliveryId)
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
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    const delivery = await getDeliveryAndVerifyOwnership(supabase, deliveryId, providerId);
    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

    const { error } = await supabase.from("partner_deliveries").delete().eq("id", deliveryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
