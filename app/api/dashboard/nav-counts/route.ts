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

    const [driversRes, fleetRes, requestsRes, deliveriesRes] = await Promise.all([
      supabase
        .from("partner_drivers")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId),

      supabase
        .from("partner_vehicles")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId),

      supabase
        .from("partner_allocation_requests")
        .select("id", { count: "exact", head: true })
        .eq("service_provider_id", providerId)
        .eq("status", "pending"),

      supabase
        .from("partner_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("status", "pending")
        .is("route_id", null),
    ]);

    return NextResponse.json({
      drivers:         driversRes.count ?? 0,
      fleet:           fleetRes.count   ?? 0,
      pendingRequests: requestsRes.count ?? 0,
      deliveries:      deliveriesRes.count ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
