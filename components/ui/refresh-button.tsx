"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onClick: () => Promise<void> | void;
  loading?: boolean;
}

export function RefreshButton({ onClick, loading = false }: RefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      await onClick();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={refreshing || loading}
      title="Refresh"
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200 select-none
        ${refreshing
          ? "border-blue-200 bg-blue-50 text-blue-500 cursor-not-allowed"
          : loading
            ? "border-gray-200 bg-white text-gray-400 opacity-50 cursor-not-allowed"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 cursor-pointer"
        }`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
      <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}
