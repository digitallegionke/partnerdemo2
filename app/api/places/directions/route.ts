import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { origin, destinations } = await req.json();

  if (!origin || !destinations || !Array.isArray(destinations)) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const key = process.env.MAPS_PLATFORM_API_KEY; 
  const waypoints = destinations.map((d) => `${d.lat},${d.lng}`).join("|");

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${
    origin.lat
  },${origin.lng}&destination=${destinations[destinations.length - 1].lat},${
    destinations[destinations.length - 1].lng
  }&waypoints=${waypoints}&key=${key}`;

  const res = await fetch(url);
  const data = await res.json();

  return NextResponse.json(data);
}