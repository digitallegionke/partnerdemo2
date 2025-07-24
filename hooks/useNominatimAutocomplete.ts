import { useState, useEffect } from 'react';

interface NominatimResult {
  place_id: string;
  licence: string;
  osm_type: string;
  osm_id: string;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
}

export function useNominatimAutocomplete(
  query: string, 
  debounceDelay = 300,
  countryCode = 'ke' // Default to Kenya, can be customized
) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!query || query.length < 3) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1${countryCode ? `&countrycodes=${countryCode}` : ''}`;
      
      fetch(searchUrl)
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch results');
          }
          return res.json();
        })
        .then((data: NominatimResult[]) => {
          setResults(data);
          setError(null);
        })
        .catch(err => {
          console.error('Nominatim API error:', err);
          setError('Failed to search locations');
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, debounceDelay);

    return () => clearTimeout(timeout);
  }, [query, debounceDelay, countryCode]);

  return { results, loading, error };
} 