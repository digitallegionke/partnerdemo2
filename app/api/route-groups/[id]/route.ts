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
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    const { data: existing } = await supabase
      .from("partner_route_groups")
      .select("id")
      .eq("id", groupId)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { name, color, route_ids } = body;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;

    const { data: group, error: updateErr } = await supabase
      .from("partner_route_groups")
      .update(updates)
      .eq("id", groupId)
      .select()
      .single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    if (Array.isArray(route_ids)) {
      // Remove all routes currently in this group
      await supabase
        .from("partner_routes")
        .update({ group_id: null })
        .eq("group_id", groupId)
        .eq("provider_id", providerId);

      // Assign the new set
      if (route_ids.length > 0) {
        await supabase
          .from("partner_routes")
          .update({ group_id: groupId })
          .in("id", route_ids)
          .eq("provider_id", providerId);
      }
    }

    return NextResponse.json(group);
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
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token!);

    const { data: existing } = await supabase
      .from("partner_route_groups")
      .select("id")
      .eq("id", groupId)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    // Ungroup all routes before deleting (ON DELETE SET NULL handles this via FK, but explicit is safer)
    await supabase
      .from("partner_routes")
      .update({ group_id: null })
      .eq("group_id", groupId);

    const { error } = await supabase
      .from("partner_route_groups")
      .delete()
      .eq("id", groupId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
