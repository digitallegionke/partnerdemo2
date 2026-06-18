"use client";

import { Truck } from "lucide-react";

export default function BusinessDeliveriesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Deliveries</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage delivery bookings made by businesses.
          </p>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Truck className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-700">
          No business deliveries yet
        </h3>
        <p className="mt-1 max-w-xs text-sm text-gray-400">
          Business delivery bookings will appear here once they are submitted.
        </p>
      </div>
    </div>
  );
}
