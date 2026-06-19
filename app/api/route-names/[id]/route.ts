import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeClient(authToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${authToken}` } },
    }
  );
}

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function getProviderId(token: string) {
  const supabase = makeClient(token);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: membership } = await supabase
    .from("partner_provider_users")
    .select("provider_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return (membership as { provider_id: number } | null)?.provider_id ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routeNameId = parseInt(id, 10);
    if (isNaN(routeNameId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const token = getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    const updates: Record<string, string | boolean | null> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    const supabase = makeClient(token);
    const { data, error } = await supabase
      .from("partner_route_names")
      .update(updates)
      .eq("id", routeNameId)
      .eq("provider_id", providerId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routeNameId = parseInt(id, 10);
    if (isNaN(routeNameId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const token = getToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = makeClient(token);
    const { error } = await supabase
      .from("partner_route_names")
      .delete()
      .eq("id", routeNameId)
      .eq("provider_id", providerId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
