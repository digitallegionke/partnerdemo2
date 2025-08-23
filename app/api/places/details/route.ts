import { NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.MAPS_PLATFORM_API_KEY;

export async function GET(request: Request) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "Missing server Google Maps API key" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const place_id = searchParams.get("place_id");

  if (!place_id) {
    return NextResponse.json(
      { error: "place_id is required" },
      { status: 400 }
    );
  }


  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(
    place_id
  )}?fields=id,displayName,formattedAddress,location`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (data.status && data.status !== "OK") {
      return NextResponse.json(
        { error: data.error_message || data.status },
        { status: 500 }
      );
    }

   
    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "Failed to fetch" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      place_id: data.id,
      name: data.displayName?.text ?? null,
      formatted_address: data.formattedAddress ?? null,
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch" },
      { status: 500 }
    );
  }
}
