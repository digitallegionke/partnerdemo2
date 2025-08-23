"use client";

import { LoadScript } from "@react-google-maps/api";

const libraries: "marker"[] = ["marker"];

export default function GoogleMapsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_EMBED_MAP as string}
      libraries={libraries}
    >
      {children}
    </LoadScript>
  );
}
