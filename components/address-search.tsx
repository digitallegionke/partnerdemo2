"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAutocomplete } from "@/hooks/use-autocomplete";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface PlacePrediction {
  place_id: string;
  description: string;
}

interface PlaceDetailResult {
  place_id: string;
  formatted_address: string;
  lat: number | null;
  lng: number | null;
}

export interface AddressSelectResult {
  place_id: string;
  display_name: string;
  coordinates: [number, number] | null;
}

interface AddressSearchProps {
  onSelect: (result: AddressSelectResult) => void;
  placeholder?: string;
  value?: string;
  className?: string;
  countryCode?: string;
  autoComplete?: string;
}

function normalizePlaceId(placeId: string) {
  return placeId.replace(/^places\//, "");
}

async function fetchPlaceDetails(place_id: string): Promise<PlaceDetailResult> {
  const params = new URLSearchParams({ place_id: normalizePlaceId(place_id) });
  const res = await fetch(`/api/places/details?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error || "Failed to fetch place details");
  }
  return res.json();
}

async function geocodeAddress(
  address: string,
  countryCode: string
): Promise<[number, number] | null> {
  const params = new URLSearchParams({ address, countryCode });
  const res = await fetch(`/api/geocode?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.lat == null || data.lng == null) return null;
  return [data.lat, data.lng];
}

async function resolveCoordinates(
  placeId: string,
  address: string,
  countryCode: string
): Promise<[number, number] | null> {
  try {
    const details = await fetchPlaceDetails(placeId);
    if (details.lat != null && details.lng != null) {
      return [details.lat, details.lng];
    }
  } catch (err) {
    console.error("Place details failed, trying geocode fallback", err);
  }
  return geocodeAddress(address, countryCode);
}

export default function AddressSearch({
  onSelect,
  placeholder = "Enter delivery address",
  value = "",
  className = "",
  countryCode = "ke",
  autoComplete = "new-password",
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [showResults, setShowResults] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const { predictions, loading, error } = useAutocomplete(
    query,
    300,
    countryCode
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep input in sync when parent resets or updates value (e.g. modal open/close)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const placePredictions = predictions.filter((p) => p.place_id);

  const updateDropdownPosition = () => {
    if (containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (!showResults) return;
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [showResults, placePredictions.length, loading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (!target.closest("[data-address-search-dropdown]")) {
          setShowResults(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowResults(true);
    updateDropdownPosition();
  };

  const handleSelectPrediction = async (p: PlacePrediction) => {
    const displayName = p.description;
    setQuery(displayName);
    setShowResults(false);
    setResolving(true);

    try {
      const coords = await resolveCoordinates(
        p.place_id,
        displayName,
        countryCode
      );

      onSelect({
        place_id: p.place_id,
        display_name: displayName,
        coordinates: coords,
      });
    } catch (err) {
      console.error("Failed to resolve address coordinates", err);
      onSelect({
        place_id: p.place_id,
        display_name: displayName,
        coordinates: null,
      });
    } finally {
      setResolving(false);
    }
  };

  const handleInputFocus = () => {
    setShowResults(true);
    updateDropdownPosition();
  };

  const showDropdown =
    showResults &&
    (placePredictions.length > 0 ||
      error ||
      (query.length >= 3 && !loading && placePredictions.length === 0));

  const dropdown =
    showDropdown && dropdownRect ? (
      <div
        data-address-search-dropdown
        className="bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        style={{
          position: "fixed",
          top: dropdownRect.bottom + 4,
          left: dropdownRect.left,
          width: dropdownRect.width,
          zIndex: 10000,
        }}
      >
        {error && (
          <div className="px-4 py-2 text-sm text-red-600">{error}</div>
        )}

        {!error &&
          query.length >= 3 &&
          !loading &&
          placePredictions.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500">
              No locations found for &quot;{query}&quot;
            </div>
          )}

        {!error &&
          placePredictions.map((pred, index) => (
            <div
              key={pred.place_id || index}
              className="px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0 transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectPrediction(pred)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 truncate">{pred.description}</div>
                </div>
              </div>
            </div>
          ))}
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
        <Input
          type="text"
          autoComplete={autoComplete}
          className="pl-10 bg-white border-gray-300"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={resolving}
        />
      </div>

      {(loading || resolving) && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        </div>
      )}

      {typeof document !== "undefined" &&
        dropdown &&
        createPortal(dropdown, document.body)}
    </div>
  );
}
