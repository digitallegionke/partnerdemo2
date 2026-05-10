import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // CRITICAL SECURITY: Require authentication to prevent API key abuse
    const supabase = createAuthenticatedClient(req.headers.get('authorization'));

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has organization membership
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 403 });
    }

    const { origin, destination, waypoints } = await req.json();

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "origin and destination are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MAPS_PLATFORM_API_KEY;

    const body = {
      origin: { latLng: { latitude: origin.lat, longitude: origin.lng } },
      destination: {
        latLng: { latitude: destination.lat, longitude: destination.lng },
      },
      intermediates: waypoints?.map((w: any) => ({
        latLng: { latitude: w.lat, longitude: w.lng },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
    };

    const res = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!data.routes?.length) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    // Sum distance and duration from all legs
    let totalDistance = 0;
    let totalDuration = 0;

    data.routes[0].legs.forEach((leg: any) => {
      totalDistance += leg.distanceMeters;
      totalDuration += leg.duration.seconds;
    });

    return NextResponse.json({
      totalDistanceMeters: totalDistance,
      totalDurationSeconds: totalDuration,
      polyline: data.routes[0].polyline?.encodedPolyline,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}