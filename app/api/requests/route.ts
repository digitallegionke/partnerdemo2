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
    const { data: requests, error } = await supabase
      .from("partner_allocation_requests")
      .select("*")
      .eq("service_provider_id", providerId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!requests?.length) return NextResponse.json([]);

    // Fetch business names — RLS policy allows partners to read orgs that sent them requests
    const businessIds = [...new Set(requests.map((r) => r.business_id))];
    const { data: businesses } = await supabase
      .from("organization")
      .select("id, company_name")
      .in("id", businessIds);

    const businessMap = Object.fromEntries(
      (businesses ?? []).map((b) => [b.id, b.company_name])
    );

    // Fetch driver allocation counts per request
    const requestIds = requests.map((r) => r.id);
    const { data: allocations } = await supabase
      .from("partner_driver_allocations")
      .select("id, request_id, status")
      .in("request_id", requestIds);

    const allocationCounts: Record<number, number> = {};
    (allocations ?? []).forEach((a) => {
      if (a.status !== "cancelled") {
        allocationCounts[a.request_id] = (allocationCounts[a.request_id] || 0) + 1;
      }
    });

    const enriched = requests.map((r) => ({
      ...r,
      business_name: businessMap[r.business_id] ?? `Business #${r.business_id}`,
      allocated_count: allocationCounts[r.id] || 0,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
