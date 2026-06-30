import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@roundi.africa";

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function serviceClient() {
  const key = SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function sendOrderEmail(
  providerEmail: string,
  providerName: string,
  order: {
    ref: string;
    customer_name: string;
    phone: string;
    pickup_location: string;
    location: string;
    item: string;
    delivery_notes: string | null;
    drop_time: string;
  }
) {
  if (!RESEND_API_KEY) return;
  const body = `
New client order received for ${providerName}

Order Reference: ${order.ref}
Customer: ${order.customer_name}
Phone: ${order.phone}
Pickup: ${order.pickup_location}
Dropoff: ${order.location}
Items: ${order.item}
Preferred Time: ${order.drop_time}
${order.delivery_notes ? `Notes: ${order.delivery_notes}` : ""}

Log in to your Roundi dashboard to review and dispatch this order.
  `.trim();

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: providerEmail,
      subject: `New Client Order: ${order.ref} — ${order.customer_name}`,
      text: body,
    }),
  }).catch(() => null);
}

// GET /api/client-orders?p=<provider_id>  — returns provider branding for the public form
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const p = searchParams.get("p");
  if (!p) return NextResponse.json({ error: "Missing provider identifier" }, { status: 400 });

  const providerId = parseInt(p, 10);
  if (Number.isNaN(providerId)) {
    return NextResponse.json({ error: "Invalid provider identifier" }, { status: 400 });
  }

  // Use service role key to bypass RLS for this public lookup
  const { data, error } = await serviceClient()
    .from("partner_providers")
    .select("id, provider_name, legal_name, city, country, status")
    .eq("id", providerId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    provider_name: data.provider_name,
    legal_name: data.legal_name ?? null,
    city: data.city ?? null,
    country: data.country ?? null,
  });
}

// POST /api/client-orders — submit a client delivery order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const {
      provider_id,
      customer_name,
      phone,
      pickup_location,
      location,
      item,
      drop_time,
      delivery_notes,
    } = body;

    if (!provider_id || !customer_name || !phone || !pickup_location || !location || !item || !drop_time) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 }
      );
    }

    // Validate the provider exists and get contact email for notification
    const { data: provider } = await anonClient()
      .from("partner_providers")
      .select("id, provider_name, contact_email")
      .eq("id", parseInt(provider_id, 10))
      .maybeSingle();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const ref = `CO-${Date.now().toString(36).toUpperCase()}`;
    const dropTimeIso = new Date(drop_time).toISOString();

    // Attempt to insert the delivery record
    const { data: delivery, error: insertError } = await serviceClient()
      .from("partner_deliveries")
      .insert({
        provider_id: provider.id,
        customer_name,
        phone,
        pickup_location,
        location,
        item,
        drop_time: dropTimeIso,
        delivery_notes: delivery_notes
          ? `[Client Order ${ref}] ${delivery_notes}`
          : `[Client Order ${ref}]`,
        status: "awaiting_approval",
      })
      .select("id")
      .single();

    if (insertError) {
      // Even if the DB insert fails, send the email notification so the provider is informed
      await sendOrderEmail(provider.contact_email, provider.provider_name, {
        ref,
        customer_name,
        phone,
        pickup_location,
        location,
        item,
        delivery_notes: delivery_notes ?? null,
        drop_time,
      });
      return NextResponse.json({ ref, notified_by_email: true }, { status: 201 });
    }

    // DB insert succeeded — also send email notification
    await sendOrderEmail(provider.contact_email, provider.provider_name, {
      ref,
      customer_name,
      phone,
      pickup_location,
      location,
      item,
      delivery_notes: delivery_notes ?? null,
      drop_time,
    });

    return NextResponse.json({ ref, delivery_id: delivery.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
