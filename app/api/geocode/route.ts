import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geocode
 * 
 * Geocode an address to get coordinates using Nominatim (OpenStreetMap)
 * This endpoint handles geocoding server-side to avoid CORS issues
 * 
 * Query parameters:
 * - address: The address to geocode (required)
 * - countryCode: Country code to limit search (optional, default: "ke")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const countryCode = searchParams.get("countryCode") || "ke";

    if (!address || address.trim().length === 0) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&limit=1&addressdetails=1${
        countryCode ? `&countrycodes=${countryCode}` : ""
      }`,
      {
        headers: {
          "User-Agent": "Roundi Delivery Management System",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Geocoding service unavailable" },
        { status: 500 }
      );
    }

    const results = await response.json();

    if (results && results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);

      if (!isNaN(lat) && !isNaN(lng)) {
        return NextResponse.json({
          lat,
          lng,
          display_name: results[0].display_name,
          address: results[0].address,
        });
      }
    }

    return NextResponse.json(
      { error: "Address not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: "Failed to geocode address" },
      { status: 500 }
    );
  }
}


