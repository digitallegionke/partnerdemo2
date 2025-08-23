"use client";

import { useEffect, useState, useRef } from "react";

interface Prediction {
  place_id: string;
  description: string;
}

export function useAutocomplete(
  input: string,
  debounceMs = 300,
  country?: string
) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // clear previous debounce timer
    window.clearTimeout(timerRef.current);

    if (!input || input.trim().length < 3) {
      setPredictions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    timerRef.current = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          input,
          ...(country ? { country } : {}),
        });

        const res = await fetch(
          `/api/places/autocomplete?${params.toString()}`
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Failed to fetch predictions");
          setPredictions([]);
        } else {
          setPredictions(data.predictions || []);
        }
      } catch (err) {
        setError((err as Error).message);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, [input, debounceMs, country]);

  return { predictions, loading, error };
}
