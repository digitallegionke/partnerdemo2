import { useState, useCallback } from "react";

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteResponse {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  polyline?: string;
}

interface UseRouteReturn {
  data: RouteResponse | null;
  loading: boolean;
  error: string | null;
  fetchRoute: (
    origin: LatLng,
    destination: LatLng,
    waypoints?: LatLng[]
  ) => Promise<void>;
}

export function useRoute(): UseRouteReturn {
  const [data, setData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(
    async (origin: LatLng, destination: LatLng, waypoints?: LatLng[]) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/routes/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination, waypoints }),
        });

        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Failed to fetch route");
          setData(null);
        } else {
          setData(json);
        }
      } catch (err) {
        console.error(err);
        setError("Network error");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, fetchRoute };
}
