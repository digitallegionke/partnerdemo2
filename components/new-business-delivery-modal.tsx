"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  X,
  MapPin,
  Users,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Phone,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import type { CreateDeliveryPayload, DeliverySizeKey } from "@/components/add-delivery-modal";

type RouteNameOption = { id: number; name: string };

type ApprovedRequest = {
  id: number;
  business_name: string;
  drivers_requested: number;
  allocated_count: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  status: string;
};

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : "";
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const auth = await getAuthHeader();
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: auth, ...options.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data;
}

async function fetchRouteNames(): Promise<RouteNameOption[]> {
  try {
    const auth = await getAuthHeader();
    const res = await fetch("/api/route-names", { headers: { Authorization: auth } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-CA");
}

function requestIdLabel(id: number) {
  return `REQ-${String(id).padStart(4, "0")}`;
}

const DELIVERY_SIZES: { key: DeliverySizeKey; dims: string; vehicle: string }[] = [
  { key: "S",  dims: "Up to 47 × 32 × 25 cm",               vehicle: "Motorbike"            },
  { key: "M",  dims: "Up to 56 × 38 × 46 cm",               vehicle: "Motorbike"            },
  { key: "L",  dims: "Up to 250 × 165 × 160 cm (≈ 6.6 m³)", vehicle: "Car / Van"            },
  { key: "XL", dims: "Up to 430 × 200 × 200 cm (≈ 17 m³)",  vehicle: "Pickup Truck / Lorry" },
];

function getSizeFromDriverTotal(total: number): DeliverySizeKey {
  if (total <= 5)  return "S";
  if (total <= 15) return "M";
  if (total <= 30) return "L";
  return "XL";
}

const APPROVED_STATUSES = ["accepted", "partially_allocated", "fully_allocated"];

const MOCK_ITEMS = [
  "Office Chairs", "Bottled Water Crates", "Printer Paper Reams", "Cleaning Supplies",
  "Branded T-Shirts", "Snack Cartons", "Electronics Accessories", "Stationery Kits",
  "Packaged Beverages", "Laptop Bags",
];
const MOCK_PLACES = [
  "Westlands, Nairobi", "Industrial Area, Nairobi", "Karen, Nairobi", "Upperhill, Nairobi",
  "Kilimani, Nairobi", "Ruaraka, Nairobi", "Mombasa Road, Nairobi", "Thika Road, Nairobi",
];
const MOCK_CUSTOMERS = [
  "Amina Wanjiru", "Brian Otieno", "Grace Njoki", "Kevin Mwangi",
  "Faith Achieng", "Daniel Kiptoo", "Mercy Wambui", "Samuel Kariuki",
];

function seededPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

// Allocation requests carry no per-item/pickup/customer data — these are
// deterministic placeholder details for demo purposes, keyed off the request id.
function mockRequestDetails(r: ApprovedRequest) {
  const seed = r.id;
  const size = getSizeFromDriverTotal(r.drivers_requested);
  const item = seededPick(MOCK_ITEMS, seed);
  const quantity = 5 + ((seed * 7) % 46);
  const unitValue = 500 + ((seed * 13) % 4500);
  const itemsValue = quantity * unitValue;
  const pickup = seededPick(MOCK_PLACES, seed + 1);
  const dropoffCandidate = seededPick(MOCK_PLACES, seed + 3);
  const dropoff = dropoffCandidate === pickup ? seededPick(MOCK_PLACES, seed + 5) : dropoffCandidate;
  const customerName = seededPick(MOCK_CUSTOMERS, seed + 2);
  const digits = String(10000000 + ((seed * 48271) % 89999999));
  const phone = `+254 7${digits[1]}${digits[2]} ${digits[3]}${digits[4]}${digits[5]} ${digits[6]}${digits[7]}${digits[0]}`;
  return { size, item, quantity, itemsValue, pickup, dropoff, customerName, phone };
}

const STATUS_LABEL: Record<string, string> = {
  accepted:            "Accepted",
  partially_allocated: "In Progress",
  fully_allocated:     "Fully Allocated",
};

interface NewBusinessDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateDeliveryPayload) => Promise<void>;
  saving?: boolean;
}

export default function NewBusinessDeliveryModal({
  open,
  onClose,
  onSubmit,
  saving = false,
}: NewBusinessDeliveryModalProps) {
  const [deliverySize, setDeliverySize] = useState<DeliverySizeKey | "">("");
  const [sizeAutoSelected, setSizeAutoSelected] = useState(false);
  const [priority, setPriority] = useState<"standard" | "express">("standard");
  const [routeNameId, setRouteNameId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [approvedRequests, setApprovedRequests] = useState<ApprovedRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [routeNames, setRouteNames] = useState<RouteNameOption[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const resetForm = () => {
    setDeliverySize("");
    setSizeAutoSelected(false);
    setPriority("standard");
    setRouteNameId(null);
    setSelectedIds(new Set());
    setExpandedIds(new Set());
    setFormError(null);
  };

  const loadApprovedRequests = async () => {
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const data: ApprovedRequest[] = await apiFetch("/api/requests");
      setApprovedRequests((data ?? []).filter((r) => APPROVED_STATUSES.includes(r.status)));
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : "Failed to load approved requests");
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (open) {
      resetForm();
      fetchRouteNames().then(setRouteNames);
      loadApprovedRequests();
      setTimeout(() => { if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0; }, 0);
    }
  }, [open]);

  useEffect(() => {
    if (selectedIds.size === 0) {
      setDeliverySize("");
      setSizeAutoSelected(false);
      return;
    }
    const totalDrivers = approvedRequests
      .filter((r) => selectedIds.has(r.id))
      .reduce((sum, r) => sum + r.drivers_requested, 0);
    setDeliverySize(getSizeFromDriverTotal(totalDrivers));
    setSizeAutoSelected(true);
  }, [selectedIds, approvedRequests]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === approvedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvedRequests.map((r) => r.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!deliverySize) {
      setFormError("Please select a delivery size.");
      return;
    }
    if (selectedIds.size === 0) {
      setFormError("Please select at least one approved delivery.");
      return;
    }

    const selected = approvedRequests.filter((r) => selectedIds.has(r.id));
    const notesParts: string[] = [`Business Delivery — Size: ${deliverySize}`];
    if (priority === "express") notesParts.push("Priority: Express");
    notesParts.push(`Requests: ${selected.map((r) => requestIdLabel(r.id)).join(", ")}`);

    const itemPayload = selected.map((r) => ({
      id: r.id,
      label: requestIdLabel(r.id),
      business: r.business_name,
      drivers: r.drivers_requested,
      start_date: r.start_date,
    }));

    try {
      await onSubmit({
        customer_name: "Business Delivery",
        pickup_location: "Business Delivery",
        location: "Business Delivery",
        item: JSON.stringify(itemPayload),
        phone: "",
        drop_time: new Date().toISOString(),
        estimated_value: null,
        weight: null,
        delivery_notes: notesParts.join(" | "),
        route_name_id: routeNameId,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create delivery");
    }
  };

  if (!open) return null;

  const allSelected = approvedRequests.length > 0 && selectedIds.size === approvedRequests.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pt-6 pb-10">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">New Business Delivery</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Consolidate approved business requests into a delivery.
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

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col min-h-0 flex-1">
          <div ref={scrollBodyRef} className="overflow-y-auto px-6 py-5 space-y-5">

            {/* ── Approved Deliveries ─────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Approved Deliveries <span className="text-red-500">*</span>
                </label>
                {approvedRequests.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>

              {loadingRequests ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400 rounded-xl border border-gray-200">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading approved requests…
                </div>
              ) : requestsError ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center rounded-xl border border-red-100 bg-red-50">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="text-sm text-red-600">{requestsError}</p>
                  <button
                    type="button"
                    onClick={loadApprovedRequests}
                    className="text-xs font-medium text-red-600 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : approvedRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center rounded-xl border border-dashed border-gray-200">
                  <CheckCircle2 className="h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No approved requests</p>
                  <p className="text-xs text-gray-400 max-w-xs">
                    Accept business allocation requests first — they'll appear here for consolidation.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="w-10 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                              allSelected
                                ? "border-emerald-500 bg-emerald-500"
                                : someSelected
                                ? "border-emerald-400 bg-white"
                                : "border-gray-300 bg-white hover:border-emerald-400"
                            }`}
                          >
                            {allSelected && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {someSelected && !allSelected && (
                              <div className="h-0.5 w-2 bg-emerald-500 rounded-full" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Request</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Business</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Drivers</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Start Date</th>
                        <th className="w-10 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {approvedRequests.map((r) => {
                        const checked = selectedIds.has(r.id);
                        const expanded = expandedIds.has(r.id);
                        const details = expanded ? mockRequestDetails(r) : null;
                        return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={() => toggleSelect(r.id)}
                            className={`cursor-pointer transition-colors ${
                              checked ? "bg-emerald-50/50" : "hover:bg-gray-50/60"
                            }`}
                          >
                            <td className="px-3 py-3">
                              <div className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                                checked
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-gray-300 bg-white"
                              }`}>
                                {checked && (
                                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-semibold text-gray-800">{requestIdLabel(r.id)}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-gray-700">{r.business_name}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                {STATUS_LABEL[r.status] ?? r.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1 text-gray-600">
                                <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                {r.drivers_requested}
                                {r.allocated_count > 0 && (
                                  <span className="text-xs text-gray-400">/ {r.allocated_count} allocated</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1 text-gray-600 text-xs">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                {formatDate(r.start_date)}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {r.status === "accepted" && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }}
                                  className="flex items-center justify-center h-6 w-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                  aria-label={expanded ? "Hide details" : "Show details"}
                                >
                                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expanded && details && (
                            <tr className="bg-gray-50/70">
                              <td />
                              <td colSpan={6} className="px-3 pb-4 pt-1">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-white p-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Size</p>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                                      <span
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold"
                                        style={{ backgroundColor: "#f0fdf4", color: "#166534" }}
                                      >
                                        {details.size}
                                      </span>
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Item</p>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                                      <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      {details.item}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Quantity</p>
                                    <p className="mt-0.5 text-sm text-gray-700">{details.quantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Items Value</p>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                                      <Banknote className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      KES {details.itemsValue.toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Pickup</p>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      {details.pickup}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Drop-off</p>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      {details.dropoff}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Customer</p>
                                    <div className="mt-1 flex items-center gap-2">
                                      <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                        style={{ backgroundColor: "#f0fdf4", color: "#166534" }}
                                      >
                                        {initials(details.customerName)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-gray-800">{details.customerName}</p>
                                        <a
                                          href={`tel:${details.phone.replace(/\s+/g, "")}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-700"
                                        >
                                          <Phone className="h-3 w-3 shrink-0" />
                                          {details.phone}
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedIds.size > 0 && (
                <p className="mt-1.5 text-xs text-emerald-700 font-medium">
                  {selectedIds.size} request{selectedIds.size !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>

            {/* ── Delivery Size ──────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Delivery Size <span className="text-red-500">*</span>
                  {sizeAutoSelected && (
                    <span className="ml-2 text-xs font-normal text-gray-400">— auto-selected from approved requests</span>
                  )}
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DELIVERY_SIZES.map(({ key, dims, vehicle }) => {
                  const selected = deliverySize === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setDeliverySize(key); setSizeAutoSelected(false); }}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        selected
                          ? "border-[#162318] ring-1 ring-[#162318]/60"
                          : "border-gray-200 bg-white hover:border-[#162318]"
                      }`}
                      style={selected ? { backgroundColor: "#f5ffd6" } : {}}
                    >
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold"
                        style={selected
                          ? { backgroundColor: "#CDF782", color: "#162318" }
                          : { backgroundColor: "#f0fdf4", color: "#166534" }}
                      >
                        {key}
                      </span>
                      <p className="mt-2 text-[11px] leading-snug text-gray-500">{dims}</p>
                      <p className="mt-1.5 text-xs font-medium text-gray-700">{vehicle}</p>
                    </button>
                  );
                })}
              </div>
              {sizeAutoSelected && (
                <p className="mt-1.5 text-[11px] text-emerald-700">
                  Auto-selected based on total drivers requested — you can override manually.
                </p>
              )}
            </div>

            {/* ── Priority & Route Name ───────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as "standard" | "express")}
                >
                  <SelectTrigger className="h-[42px] rounded-lg border-gray-200">
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Route Name</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                  <Select
                    value={routeNameId != null ? String(routeNameId) : "none"}
                    onValueChange={(v) => setRouteNameId(v === "none" ? null : Number(v))}
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
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px", fontSize: 14, fontWeight: 600, minWidth: 140,
                color: "#162318", backgroundColor: saving ? "#bfe96f" : "#CDF782",
                border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f"; }}
              onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782"; }}
            >
              {saving ? "Creating…" : "Create Business Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
