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
    const token = getToken(req);
    const providerId = await getProviderId(token);
    if (!providerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const supabase = makeClient(token!);

    // Verify request belongs to this provider
    const { data: existing } = await supabase
      .from("partner_allocation_requests")
      .select("id, service_provider_id, status")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (!existing || existing.service_provider_id !== providerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.provider_notes !== undefined) updateData.provider_notes = body.provider_notes;
    if (body.status === "accepted" || body.status === "rejected") {
      updateData.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("partner_allocation_requests")
      .update(updateData)
      .eq("id", parseInt(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
