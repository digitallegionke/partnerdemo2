"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  User,
  Search,
  Clock,
  Bike,
  Car,
  Truck,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AddressSearch, {
  type AddressSelectResult,
} from "@/components/address-search";

export type DeliverySizeKey = "S" | "M" | "L" | "XL";

export type DeliveryPriority = "standard" | "express";

export type CreateDeliveryPayload = {
  customer_name: string;
  location: string;
  coordinates?: [number, number];
  item: string;
  phone: string;
  drop_time: string;
  estimated_value: string | null;
  weight: string | null;
  delivery_notes: string | null;
};

type RoutePoint = { lat: string; lng: string };

const DELIVERY_SIZES: {
  key: DeliverySizeKey;
  dims: string;
  vehicle: string;
  Icon: typeof Bike;
}[] = [
  { key: "S", dims: "Up to 20 × 7 × 15 cm", vehicle: "Motorbike", Icon: Bike },
  { key: "M", dims: "Up to 37 × 18 × 30 cm", vehicle: "Motorbike", Icon: Bike },
  { key: "L", dims: "Up to 48 × 23 × 38 cm", vehicle: "Car / Van", Icon: Car },
  { key: "XL", dims: "Over 40 × 40 × 40 cm", vehicle: "Pickup Truck", Icon: Truck },
];

const EMPTY_FORM = {
  clientQuery: "",
  selectedClient: "" as string,
  deliverySize: "" as DeliverySizeKey | "",
  customer_name: "",
  phone: "",
  location: "",
  lat: "",
  lng: "",
  item: "",
  drop_time: "",
  estimated_value: "",
  weight: "",
  priority: "standard" as DeliveryPriority,
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeRouteDistanceKm(
  lat: string,
  lng: string,
  routePoints: RoutePoint[]
): number | null {
  const dLat = parseFloat(lat);
  const dLng = parseFloat(lng);
  if (Number.isNaN(dLat) || Number.isNaN(dLng) || routePoints.length === 0) return null;

  let min = Infinity;
  for (const p of routePoints) {
    const rLat = parseFloat(p.lat);
    const rLng = parseFloat(p.lng);
    if (Number.isNaN(rLat) || Number.isNaN(rLng)) continue;
    min = Math.min(min, haversineKm(dLat, dLng, rLat, rLng));
  }
  return min === Infinity ? null : Math.round(min * 10) / 10;
}

function formatCoordPreview(lat: string, lng: string) {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  if (Number.isNaN(la) || Number.isNaN(ln)) return null;
  return `${la.toFixed(4)}, ${ln.toFixed(4)}`;
}

function buildDropTimeIso(timeValue: string) {
  if (!timeValue) return "";
  const [hours, minutes] = timeValue.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes ?? 0, 0, 0);
  return d.toISOString();
}

function FieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {hint && (
        <span className="font-normal text-gray-400"> — {hint}</span>
      )}
    </label>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500";

interface AddDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateDeliveryPayload) => Promise<void>;
  saving?: boolean;
  /** Route start points used to estimate distance to nearest route */
  routePoints?: RoutePoint[];
  /** Optional client names for search (e.g. from businesses) */
  clientOptions?: string[];
}

export default function AddDeliveryModal({
  open,
  onClose,
  onSubmit,
  saving = false,
  routePoints = [],
  clientOptions = [],
}: AddDeliveryModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [showClientResults, setShowClientResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormError(null);
      setShowClientResults(false);
    }
  }, [open]);

  const routeDistanceKm = useMemo(
    () => computeRouteDistanceKm(form.lat, form.lng, routePoints),
    [form.lat, form.lng, routePoints]
  );

  const handleLocationSelect = (result: AddressSelectResult) => {
    setForm((f) => ({
      ...f,
      location: result.display_name,
      lat: result.coordinates ? result.coordinates[0].toString() : "",
      lng: result.coordinates ? result.coordinates[1].toString() : "",
    }));
  };

  const filteredClients = useMemo(() => {
    const q = form.clientQuery.trim().toLowerCase();
    if (!q) return clientOptions.slice(0, 8);
    return clientOptions.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [form.clientQuery, clientOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.deliverySize) {
      setFormError("Please select a delivery size.");
      return;
    }
    if (!form.customer_name.trim()) {
      setFormError("Customer name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("Phone number is required.");
      return;
    }
    if (!form.location.trim()) {
      setFormError("Delivery location is required.");
      return;
    }
    if (!form.lat.trim() || !form.lng.trim()) {
      setFormError("Latitude and longitude are required.");
      return;
    }
    if (!form.item.trim()) {
      setFormError("Item description is required.");
      return;
    }
    if (!form.drop_time) {
      setFormError("Drop time is required.");
      return;
    }

    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setFormError("Enter valid coordinates.");
      return;
    }

    const notesParts: string[] = [];
    const client = form.selectedClient || form.clientQuery.trim();
    if (client) notesParts.push(`Client: ${client}`);
    notesParts.push(`Size: ${form.deliverySize}`);
    if (form.priority === "express") notesParts.push("Priority: Express");
    if (routeDistanceKm != null) notesParts.push(`Route distance: ${routeDistanceKm} km`);

    let estimatedValue = form.estimated_value.trim() || null;
    if (estimatedValue && !estimatedValue.toLowerCase().includes("ksh")) {
      estimatedValue = `KSh ${estimatedValue.replace(/^[^\d]*/, "")}`;
    }

    try {
      await onSubmit({
        customer_name: form.customer_name.trim(),
        location: form.location.trim(),
        coordinates: [lat, lng],
        item: form.item.trim(),
        phone: form.phone.trim(),
        drop_time: buildDropTimeIso(form.drop_time),
        estimated_value: estimatedValue,
        weight: form.weight.trim() || null,
        delivery_notes: notesParts.length ? notesParts.join(" | ") : null,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create delivery");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Delivery</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Add a new delivery to the system.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            {/* Client */}
            <div className="relative">
              <FieldLabel hint="optional">Client</FieldLabel>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={form.clientQuery}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      clientQuery: e.target.value,
                      selectedClient: "",
                    }));
                    setShowClientResults(true);
                  }}
                  onFocus={() => setShowClientResults(true)}
                  className={`${inputCls} pl-9 mt-0`}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
              </div>
              {showClientResults && filteredClients.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-40 overflow-auto">
                  {filteredClients.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            clientQuery: name,
                            selectedClient: name,
                          }));
                          setShowClientResults(false);
                        }}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Delivery size */}
            <div>
              <FieldLabel required hint="determines vehicle type">
                Delivery Size
              </FieldLabel>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DELIVERY_SIZES.map(({ key, dims, vehicle, Icon }) => {
                  const selected = form.deliverySize === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, deliverySize: key }))
                      }
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        selected
                          ? "border-emerald-500 bg-emerald-50/80 ring-1 ring-emerald-500/30"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                          selected
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {key}
                      </span>
                      <p className="mt-2 text-[11px] leading-snug text-gray-500">
                        {dims}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-gray-700">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {vehicle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer + phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Customer Name</FieldLabel>
                <input
                  required
                  placeholder="Recipient name"
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customer_name: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel required>Phone Number</FieldLabel>
                <input
                  required
                  type="tel"
                  placeholder="+254 712 345 678"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <FieldLabel required>Delivery Location</FieldLabel>
              <AddressSearch
                value={form.location}
                placeholder="Enter delivery address"
                className="mt-1.5"
                countryCode="ke"
                onSelect={handleLocationSelect}
              />
              {(() => {
                const preview = formatCoordPreview(form.lat, form.lng);
                return preview ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {preview}
                  </p>
                ) : null;
              })()}
            </div>

            {/* Coordinates — text inputs so minus signs and partial values work */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Latitude</FieldLabel>
                <input
                  id="delivery-latitude"
                  name="latitude"
                  required
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="-1.2921"
                  value={form.lat}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lat: e.target.value }))
                  }
                  onFocus={() => setShowClientResults(false)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-filled when selecting address
                </p>
              </div>
              <div>
                <FieldLabel required>Longitude</FieldLabel>
                <input
                  id="delivery-longitude"
                  name="longitude"
                  required
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="36.8219"
                  value={form.lng}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lng: e.target.value }))
                  }
                  onFocus={() => setShowClientResults(false)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-filled when selecting address
                </p>
              </div>
            </div>

            {/* Item + drop time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Item</FieldLabel>
                <input
                  required
                  placeholder="What's being delivered?"
                  value={form.item}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, item: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel required>Drop Time</FieldLabel>
                <div className="relative mt-1.5">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    required
                    type="time"
                    value={form.drop_time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, drop_time: e.target.value }))
                    }
                    className={`${inputCls} pl-9 mt-0`}
                  />
                </div>
              </div>
            </div>

            {/* Value + weight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Estimated Value</FieldLabel>
                <input
                  placeholder="KSh 2,500"
                  value={form.estimated_value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, estimated_value: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel hint="used for rate quote">Weight (kg)</FieldLabel>
                <input
                  placeholder="e.g. 3.5"
                  inputMode="decimal"
                  value={form.weight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, weight: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            {/* Priority + route distance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Priority</FieldLabel>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: v as DeliveryPriority,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1.5 h-[42px] rounded-lg border-gray-200">
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel hint="computed from coordinates">
                  Route Distance (km)
                </FieldLabel>
                <div className="relative mt-1.5">
                  <Route className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    readOnly
                    disabled
                    value={
                      routeDistanceKm != null
                        ? String(routeDistanceKm)
                        : ""
                    }
                    placeholder="Enter coordinates above"
                    className={`${inputCls} pl-9 mt-0 bg-gray-50 text-gray-600 cursor-not-allowed`}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50/80 rounded-b-2xl shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-400 hover:bg-emerald-500 text-gray-900 font-semibold min-w-[140px]"
            >
              {saving ? "Creating..." : "Create Delivery"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
