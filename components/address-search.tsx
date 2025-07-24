"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useNominatimAutocomplete } from '@/hooks/useNominatimAutocomplete';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';

interface NominatimResult {
  place_id: string;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: string[];
  importance: number;
}

interface AddressSearchProps {
  onSelect: (result: NominatimResult & { coordinates: [number, number] }) => void;
  placeholder?: string;
  value?: string;
  className?: string;
  countryCode?: string;
}

export default function AddressSearch({ 
  onSelect, 
  placeholder = "Enter delivery address",
  value = "",
  className = "",
  countryCode = "ke"
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [showResults, setShowResults] = useState(false);
  const { results, loading, error } = useNominatimAutocomplete(query, 300, countryCode);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update query when value prop changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setShowResults(true);
  };

  const handleSelectResult = (result: NominatimResult) => {
    setQuery(result.display_name);
    setShowResults(false);
    
    // Call onSelect with enhanced result including coordinates array
    onSelect({
      ...result,
      coordinates: [parseFloat(result.lat), parseFloat(result.lon)]
    });
  };

  const handleInputFocus = () => {
    if (results.length > 0) {
      setShowResults(true);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          className="pl-10 bg-white border-gray-300"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
        />
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        </div>
      )}

      {/* Results dropdown */}
      {showResults && (results.length > 0 || error || (query.length >= 3 && !loading && results.length === 0)) && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {error && (
            <div className="px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          
          {!error && query.length >= 3 && !loading && results.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-500">
              No locations found for "{query}"
            </div>
          )}

          {!error && results.map((result, index) => (
            <div
              key={result.place_id || index}
              className="px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm border-b border-gray-100 last:border-b-0 transition-colors"
              onClick={() => handleSelectResult(result)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 truncate">
                    {result.display_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {parseFloat(result.lat).toFixed(4)}, {parseFloat(result.lon).toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 