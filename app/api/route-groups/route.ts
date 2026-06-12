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
    const { data: groups, error } = await supabase
      .from("partner_route_groups")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(groups ?? []);
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
    if (!body?.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const { name, color, route_ids } = body;

    const supabase = makeClient(token!);

    const { data: group, error: groupErr } = await supabase
      .from("partner_route_groups")
      .insert({ provider_id: providerId, name: name.trim(), color: color ?? "#10B981" })
      .select()
      .single();

    if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 });

    if (Array.isArray(route_ids) && route_ids.length > 0) {
      await supabase
        .from("partner_routes")
        .update({ group_id: group.id })
        .in("id", route_ids)
        .eq("provider_id", providerId);
    }

    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
