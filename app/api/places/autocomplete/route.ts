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
  const input = searchParams.get("input") || "";
  const country = searchParams.get("country") || "";

  if (input.trim().length < 1) {
    return NextResponse.json({ predictions: [] });
  }

  const body: any = { input };

  if (country) {
    body.includedRegionCodes = [country.toUpperCase()];
  }

  
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
        },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: data.error_message || data.status },
        { status: 500 }
      );
    }

   const predictions = (data.suggestions || [])
     .map((p: any) => {
       if (p.placePrediction) {
         return {
           type: "place",
           place_id: p.placePrediction.placeId,
           description: p.placePrediction.text?.text,
         };
       }
       if (p.queryPrediction) {
         return {
           type: "query",
           place_id: null,
           description: p.queryPrediction.text?.text,
         };
       }
       return null;
     })
     .filter(Boolean);

    return NextResponse.json({ predictions });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch" },
      { status: 500 }
    );
  }
}