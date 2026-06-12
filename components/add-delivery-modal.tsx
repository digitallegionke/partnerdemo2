"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  User,
  Search,
  Clock,
  Bike,
  Car,
  Truck,
  Ruler,
  Pencil,
  Trash2,
  MapPin,
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
import { supabase } from "@/lib/supabase";

type ClientOption = {
  id: number;
  company_name: string;
  contact_name: string;
  status: string;
};

type RouteNameOption = {
  id: number;
  name: string;
};

async function fetchActiveClients(): Promise<ClientOption[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ? `Bearer ${session.access_token}` : "";
    const res = await fetch("/api/clients", { headers: { Authorization: token } });
    if (!res.ok) return [];
    const data: ClientOption[] = await res.json();
    return data.filter((c) => c.status === "active");
  } catch {
    return [];
  }
}

async function fetchRouteNames(): Promise<RouteNameOption[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ? `Bearer ${session.access_token}` : "";
    const res = await fetch("/api/route-names", { headers: { Authorization: token } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export type DeliverySizeKey = "S" | "M" | "L" | "XL";

export type DeliveryPriority = "standard" | "express";

export type DeliveryItem = { name: string; value: string; weight: string; size: DeliverySizeKey | "" };

export type CreateDeliveryPayload = {
  customer_name: string;
  pickup_location: string;
  pickup_coordinates?: [number, number];
  location: string;
  coordinates?: [number, number];
  item: string;
  phone: string;
  drop_time: string;
  estimated_value: string | null;
  weight: string | null;
  delivery_notes: string | null;
  route_name_id?: number | null;
};

// Parcel sizes — dimensions of the individual item being shipped
const PARCEL_SIZES: { key: DeliverySizeKey; label: string; dims: string }[] = [
  { key: "S",  label: "Small",   dims: "Up to 20 × 7 × 15 cm" },
  { key: "M",  label: "Medium",  dims: "Up to 37 × 18 × 30 cm" },
  { key: "L",  label: "Large",   dims: "Up to 48 × 23 × 38 cm" },
  { key: "XL", label: "X-Large", dims: "Over 40 × 40 × 40 cm" },
];

const PARCEL_SIZE_VOLUMES: Record<DeliverySizeKey, number> = {
  S:  20 * 7 * 15,
  M:  37 * 18 * 30,
  L:  48 * 23 * 38,
  XL: 40 * 40 * 40,
};

// Delivery sizes — vehicle capacity needed for the shipment
const DELIVERY_SIZES: {
  key: DeliverySizeKey;
  dims: string;
  vehicle: string;
  Icon: typeof Bike;
}[] = [
  { key: "S",  dims: "Up to 47 × 32 × 25 cm",              vehicle: "Motorbike",          Icon: Bike  },
  { key: "M",  dims: "Up to 56 × 38 × 46 cm",              vehicle: "Motorbike",          Icon: Bike  },
  { key: "L",  dims: "Up to 250 × 165 × 160 cm (≈ 6.6 m³)", vehicle: "Car / Van",          Icon: Car   },
  { key: "XL", dims: "Up to 430 × 200 × 200 cm (≈ 17 m³)", vehicle: "Pickup Truck / Lorry", Icon: Truck },
];

const DELIVERY_SIZE_VOLUMES: Record<DeliverySizeKey, number> = {
  S:  47 * 32 * 25,
  M:  56 * 38 * 46,
  L:  250 * 165 * 160,
  XL: 430 * 200 * 200,
};

function getDeliverySizeFromVolume(volume: number): DeliverySizeKey {
  if (volume <= DELIVERY_SIZE_VOLUMES.S) return "S";
  if (volume <= DELIVERY_SIZE_VOLUMES.M) return "M";
  if (volume <= DELIVERY_SIZE_VOLUMES.L) return "L";
  return "XL";
}


const EMPTY_FORM = {
  clientQuery: "",
  selectedClient: "" as string,
  deliverySize: "" as DeliverySizeKey | "",
  customer_name: "",
  phone: "",
  pickup_location: "",
  pickup_lat: "",
  pickup_lng: "",
  location: "",
  lat: "",
  lng: "",
  items: [] as DeliveryItem[],
  drop_time: "",
  priority: "standard" as DeliveryPriority,
  routeNameId: null as number | null,
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

function computeDeliveryDistance(
  pickupLat: string,
  pickupLng: string,
  dropoffLat: string,
  dropoffLng: string
): number | null {
  const pLat = parseFloat(pickupLat);
  const pLng = parseFloat(pickupLng);
  const dLat = parseFloat(dropoffLat);
  const dLng = parseFloat(dropoffLng);
  if ([pLat, pLng, dLat, dLng].some(Number.isNaN)) return null;
  return Math.round(haversineKm(pLat, pLng, dLat, dLng) * 10) / 10;
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
      {hint && <span className="font-normal text-gray-400"> — {hint}</span>}
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
  clientOptions?: string[]; // kept for backward compat, ignored
}

export default function AddDeliveryModal({
  open,
  onClose,
  onSubmit,
  saving = false,
}: AddDeliveryModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [showClientResults, setShowClientResults] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DeliveryItem>({ name: "", value: "", weight: "", size: "" });
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [routeNames, setRouteNames] = useState<RouteNameOption[]>([]);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetchActiveClients().then(setClients);
      fetchRouteNames().then(setRouteNames);
      // Reset scroll to top whenever the modal opens
      setTimeout(() => { if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0; }, 0);
    } else {
      setForm(EMPTY_FORM);
      setFormError(null);
      setShowClientResults(false);
      setEditingIndex(null);
      setEditForm({ name: "", value: "", weight: "", size: "" });
    }
  }, [open]);

  const deliveryDistanceKm = useMemo(
    () =>
      computeDeliveryDistance(
        form.pickup_lat,
        form.pickup_lng,
        form.lat,
        form.lng
      ),
    [form.pickup_lat, form.pickup_lng, form.lat, form.lng]
  );

  const totalValue = useMemo(
    () => form.items.reduce((sum, item) => {
      const val = parseFloat(item.value.replace(/[^\d.]/g, ""));
      return sum + (isNaN(val) ? 0 : val);
    }, 0),
    [form.items]
  );

  const totalWeight = useMemo(
    () => form.items.reduce((sum, item) => {
      const w = parseFloat(item.weight.replace(/[^\d.]/g, ""));
      return sum + (isNaN(w) ? 0 : w);
    }, 0),
    [form.items]
  );

  const totalVolume = useMemo(
    () => form.items.reduce((sum, item) => {
      if (!item.size) return sum;
      return sum + PARCEL_SIZE_VOLUMES[item.size];
    }, 0),
    [form.items]
  );

  useEffect(() => {
    if (totalVolume > 0) {
      setForm((f) => ({ ...f, deliverySize: getDeliverySizeFromVolume(totalVolume) }));
    }
  }, [totalVolume]);

  useEffect(() => {
    if (form.items.length === 0) {
      setEditingIndex(-1);
      setEditForm({ name: "", value: "", weight: "", size: "" });
    }
  }, [form.items.length]);

  const handlePickupSelect = (result: AddressSelectResult) => {
    setForm((f) => ({
      ...f,
      pickup_location: result.display_name,
      pickup_lat: result.coordinates ? result.coordinates[0].toString() : "",
      pickup_lng: result.coordinates ? result.coordinates[1].toString() : "",
    }));
  };

  const handleDropoffSelect = (result: AddressSelectResult) => {
    setForm((f) => ({
      ...f,
      location: result.display_name,
      lat: result.coordinates ? result.coordinates[0].toString() : "",
      lng: result.coordinates ? result.coordinates[1].toString() : "",
    }));
  };

  const filteredClients = useMemo(() => {
    const q = form.clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.contact_name.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [form.clientQuery, clients]);

  const handleSaveItem = () => {
    if (!editForm.name.trim()) return;
    setForm((f) => {
      if (editingIndex === -1) return { ...f, items: [...f.items, editForm] };
      return { ...f, items: f.items.map((it, i) => (i === editingIndex ? editForm : it)) };
    });
    setEditingIndex(null);
    setEditForm({ name: "", value: "", weight: "", size: "" });
  };

  const handleEditItem = (index: number) => {
    setEditForm(form.items[index]);
    setEditingIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditForm({ name: "", value: "", weight: "", size: "" });
    }
  };

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
    if (!form.pickup_location.trim()) {
      setFormError("Pick up location is required.");
      return;
    }
    if (!form.pickup_lat.trim() || !form.pickup_lng.trim()) {
      setFormError("Pick up coordinates are required.");
      return;
    }
    if (!form.location.trim()) {
      setFormError("Drop off location is required.");
      return;
    }
    if (!form.lat.trim() || !form.lng.trim()) {
      setFormError("Drop off coordinates are required.");
      return;
    }
    const validItems = form.items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      setFormError("At least one item is required.");
      return;
    }
    if (validItems.some((i) => !i.size)) {
      setFormError("Please select a size for each item.");
      return;
    }
    if (!form.drop_time) {
      setFormError("Drop time is required.");
      return;
    }

    const pickupLat = parseFloat(form.pickup_lat);
    const pickupLng = parseFloat(form.pickup_lng);
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);

    if (Number.isNaN(pickupLat) || Number.isNaN(pickupLng)) {
      setFormError("Enter valid pick up coordinates.");
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setFormError("Enter valid drop off coordinates.");
      return;
    }

    const notesParts: string[] = [];
    const client = form.selectedClient || form.clientQuery.trim();
    if (client) notesParts.push(`Client: ${client}`);
    notesParts.push(`Size: ${form.deliverySize}`);
    if (form.priority === "express") notesParts.push("Priority: Express");
    if (deliveryDistanceKm != null) notesParts.push(`Distance: ${deliveryDistanceKm} km`);

    const estimatedValue = totalValue > 0
      ? `KSh ${totalValue.toLocaleString("en-KE")}`
      : null;

    const weightValue = totalWeight > 0
      ? String(Math.round(totalWeight * 100) / 100)
      : null;

    try {
      await onSubmit({
        customer_name: form.customer_name.trim(),
        pickup_location: form.pickup_location.trim(),
        pickup_coordinates: [pickupLat, pickupLng],
        location: form.location.trim(),
        coordinates: [lat, lng],
        item: JSON.stringify(validItems),
        phone: form.phone.trim(),
        drop_time: buildDropTimeIso(form.drop_time),
        estimated_value: estimatedValue,
        weight: weightValue,
        delivery_notes: notesParts.length ? notesParts.join(" | ") : null,
        route_name_id: form.routeNameId,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create delivery");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pt-6 pb-10">
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

        <form onSubmit={handleSubmit} autoComplete="new-password" className="flex flex-col min-h-0 flex-1">
          <div ref={scrollBodyRef} className="overflow-y-auto px-6 py-5 space-y-5">

            {/* ── Client ─────────────────────────────── */}
              <div className="relative">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    autoComplete="new-password"
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
                    onBlur={() => setTimeout(() => setShowClientResults(false), 150)}
                    className={`${inputCls} pl-9 mt-0`}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                </div>
                {showClientResults && filteredClients.length > 0 && (
                  <ul
                    className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-48 overflow-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredClients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              clientQuery: c.company_name,
                              selectedClient: c.company_name,
                            }));
                            setShowClientResults(false);
                          }}
                        >
                          <p className="text-sm font-medium text-gray-800">{c.company_name}</p>
                          <p className="text-xs text-gray-400">{c.contact_name}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {showClientResults && form.clientQuery.trim() && filteredClients.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-3">
                    <p className="text-sm text-gray-400">No active clients found</p>
                  </div>
                )}
              </div>

            {/* ── Delivery Size ──────────────────────── */}
              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel required hint="auto-selected from item sizes">
                    Delivery Size
                  </FieldLabel>
                  {totalVolume > 0 && (
                    <span className="text-xs text-gray-500">
                      Items total:{" "}
                      <span className="font-semibold text-gray-700">
                        {totalVolume.toLocaleString("en-KE")} cm³
                      </span>
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DELIVERY_SIZES.map(({ key, dims, vehicle, Icon }) => {
                    const selected = form.deliverySize === key;
                    const vol = DELIVERY_SIZE_VOLUMES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, deliverySize: key }))}
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
                        <p className="mt-2 text-[11px] leading-snug text-gray-500">{dims}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {vol.toLocaleString("en-KE")} cm³
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-700">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {vehicle}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {totalVolume > 0 && (
                  <p className="mt-1.5 text-[11px] text-emerald-700">
                    Auto-selected based on total item volume — you can override manually.
                  </p>
                )}
              </div>

            {/* ── Recipient ──────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Customer Name</FieldLabel>
                  <input
                    required
                    autoComplete="new-password"
                    placeholder="Recipient name"
                    value={form.customer_name}
                    onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel required>Phone Number</FieldLabel>
                  <input
                    required
                    type="tel"
                    autoComplete="new-password"
                    placeholder="+254 712 345 678"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

            {/* ── Pick Up ────────────────────────────── */}
              <div>
                <FieldLabel required>Location</FieldLabel>
                <AddressSearch
                  value={form.pickup_location}
                  placeholder="Enter pick up address"
                  className="mt-1.5"
                  countryCode="ke"
                  onSelect={handlePickupSelect}
                />
                {formatCoordPreview(form.pickup_lat, form.pickup_lng) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {formatCoordPreview(form.pickup_lat, form.pickup_lng)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Latitude</FieldLabel>
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    autoComplete="new-password"
                    placeholder="-1.2921"
                    value={form.pickup_lat}
                    onChange={(e) => setForm((f) => ({ ...f, pickup_lat: e.target.value }))}
                    onFocus={() => setShowClientResults(false)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-filled when selecting address</p>
                </div>
                <div>
                  <FieldLabel required>Longitude</FieldLabel>
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    autoComplete="new-password"
                    placeholder="36.8219"
                    value={form.pickup_lng}
                    onChange={(e) => setForm((f) => ({ ...f, pickup_lng: e.target.value }))}
                    onFocus={() => setShowClientResults(false)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-filled when selecting address</p>
                </div>
              </div>

            {/* ── Drop Off ───────────────────────────── */}
              <div>
                <FieldLabel required>Location</FieldLabel>
                <AddressSearch
                  value={form.location}
                  placeholder="Enter drop off address"
                  className="mt-1.5"
                  countryCode="ke"
                  onSelect={handleDropoffSelect}
                />
                {formatCoordPreview(form.lat, form.lng) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {formatCoordPreview(form.lat, form.lng)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Latitude</FieldLabel>
                  <input
                    id="delivery-latitude"
                    name="latitude"
                    required
                    type="text"
                    inputMode="decimal"
                    autoComplete="new-password"
                    placeholder="-1.2921"
                    value={form.lat}
                    onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                    onFocus={() => setShowClientResults(false)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-filled when selecting address</p>
                </div>
                <div>
                  <FieldLabel required>Longitude</FieldLabel>
                  <input
                    id="delivery-longitude"
                    name="longitude"
                    required
                    type="text"
                    inputMode="decimal"
                    autoComplete="new-password"
                    placeholder="36.8219"
                    value={form.lng}
                    onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                    onFocus={() => setShowClientResults(false)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-filled when selecting address</p>
                </div>
              </div>

            {/* ── Items ──────────────────────────────── */}
            <div>
              <FieldLabel required>Items</FieldLabel>

              {form.items.length > 0 && (
                <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Item</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Size</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Value</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Weight</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.items.map((item, index) => (
                        <tr
                          key={index}
                          className={`transition-colors ${editingIndex === index ? "bg-emerald-50/40" : "hover:bg-gray-50/50"}`}
                        >
                          <td className="px-3 py-2.5 font-medium text-gray-900">{item.name}</td>
                          <td className="px-3 py-2.5">
                            {item.size ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700">
                                {item.size}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {item.value
                              ? `KSh ${parseFloat(item.value.replace(/[^\d.]/g, "")).toLocaleString("en-KE")}`
                              : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {item.weight ? `${item.weight} kg` : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-0.5 justify-end">
                              <button
                                type="button"
                                onClick={() => handleEditItem(index)}
                                className="p-1.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(index)}
                                className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {editingIndex !== null && (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-700">
                    {editingIndex === -1 ? "New item" : "Edit item"}
                  </p>
                  <input
                    autoComplete="new-password"
                    placeholder="What's being delivered?"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputCls}
                  />
                  <div className="grid grid-cols-4 gap-1.5">
                    {PARCEL_SIZES.map(({ key, label, dims }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, size: key }))}
                        className={`rounded-lg border-2 px-2 py-2 flex flex-col items-start gap-0.5 text-left transition-all ${
                          editForm.size === key
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                          editForm.size === key ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {key}
                        </span>
                        <span className={`text-[11px] font-semibold mt-0.5 ${editForm.size === key ? "text-emerald-700" : "text-gray-700"}`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400 leading-tight">{dims}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      autoComplete="new-password"
                      placeholder="Estimated value (KSh)"
                      inputMode="decimal"
                      value={editForm.value}
                      onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                      className={inputCls}
                    />
                    <input
                      autoComplete="new-password"
                      placeholder="Weight (kg)"
                      inputMode="decimal"
                      value={editForm.weight}
                      onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-0.5">
                    {(editingIndex !== -1 || form.items.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!editForm.name.trim() || !editForm.size}
                      onClick={handleSaveItem}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {editingIndex === -1 ? "Add Item" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                {editingIndex === null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm({ name: "", value: "", weight: "", size: "" });
                      setEditingIndex(-1);
                    }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </button>
                ) : (
                  <div />
                )}
                {(totalValue > 0 || totalWeight > 0 || totalVolume > 0) && (
                  <div className="flex gap-2 flex-wrap justify-end">
                    {totalValue > 0 && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5 text-right">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Approx. value</p>
                        <p className="text-sm font-semibold text-gray-900">KSh {totalValue.toLocaleString("en-KE")}</p>
                      </div>
                    )}
                    {totalWeight > 0 && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5 text-right">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Total weight</p>
                        <p className="text-sm font-semibold text-gray-900">{Math.round(totalWeight * 100) / 100} kg</p>
                      </div>
                    )}
                    {totalVolume > 0 && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5 text-right">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Total volume</p>
                        <p className="text-sm font-semibold text-gray-900">{totalVolume.toLocaleString("en-KE")} cm³</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Schedule ───────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Drop Time</FieldLabel>
                  <div className="relative mt-1.5">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      required
                      type="time"
                      value={form.drop_time}
                      onChange={(e) => setForm((f) => ({ ...f, drop_time: e.target.value }))}
                      className={`${inputCls} pl-9 mt-0`}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <Select
                    value={form.priority}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, priority: v as DeliveryPriority }))
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
              </div>

            {/* ── Route Name ─────────────────────────── */}
              <div>
                <FieldLabel>Route Name</FieldLabel>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                  <Select
                    value={form.routeNameId != null ? String(form.routeNameId) : "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, routeNameId: v === "none" ? null : Number(v) }))
                    }
                  >
                    <SelectTrigger className="h-[42px] rounded-lg border-gray-200 pl-9">
                      <SelectValue placeholder="Select a route name (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {routeNames.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <FieldLabel hint="pick up → drop off">Distance (km)</FieldLabel>
                <div className="relative mt-1.5">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    readOnly
                    disabled
                    value={deliveryDistanceKm != null ? String(deliveryDistanceKm) : ""}
                    placeholder="Enter both locations above"
                    className={`${inputCls} pl-9 mt-0 bg-gray-50 text-gray-600 cursor-not-allowed`}
                  />
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
