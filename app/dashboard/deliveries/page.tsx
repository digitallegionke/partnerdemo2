"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  Download,
  Upload,
  Link2,
  LayoutGrid,
  List,
  Zap,
  RefreshCw,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AddDeliveryModal, {
  type CreateDeliveryPayload,
} from "@/components/add-delivery-modal";
import EditDeliveryModal from "@/components/edit-delivery-modal";
import DeliveryViewModal, { type ViewableDelivery } from "@/components/delivery-view-modal";
import { supabase, parsePointCoordinates } from "@/lib/supabase";
import { toWebStatus } from "@/lib/deliveryStatusMapper";
import type { Database } from "@/lib/supabase";

type PartnerDelivery = Database["public"]["Tables"]["partner_deliveries"]["Row"];

type DisplayStatus =
  | "awaiting_approval"
  | "pending"
  | "rejected"
  | "out_for_delivery"
  | "cancelled"
  | "in_transit"
  | "delivered"
  | "failed";

type EnrichedDelivery = PartnerDelivery & {
  displayStatus: DisplayStatus;
  driverName: string;
  routeName: string | null;
  routeNameLabel: string | null;
  distanceKm: number | null;
};

type PartnerRoute = {
  id: number;
  name: string;
  driver_id: number | null;
  lat: string;
  lng: string;
  driver: { id: number; name: string } | null;
};

type FilterKey =
  | "all"
  | "awaiting_approval"
  | "pending"
  | "out_for_delivery"
  | "in_transit"
  | "delivered"
  | "rejected"
  | "cancelled"
  | "failed";

type PageTab = "deliveries" | "pickups";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all",               label: "All" },
  { key: "awaiting_approval", label: "Awaiting Approval" },
  { key: "pending",           label: "Pending" },
  { key: "out_for_delivery",  label: "Out for Delivery" },
  { key: "in_transit",        label: "In Transit" },
  { key: "delivered",         label: "Delivered" },
  { key: "rejected",          label: "Rejected" },
  { key: "cancelled",         label: "Cancelled" },
  { key: "failed",            label: "Failed" },
];

const STATUS_BADGE: Record<DisplayStatus, { label: string; cls: string; dot: string }> = {
  awaiting_approval: { label: "Awaiting Approval", cls: "bg-blue-50 text-blue-700",     dot: "bg-blue-500"    },
  pending:           { label: "Pending",           cls: "bg-amber-50 text-amber-700",   dot: "bg-amber-400"   },
  rejected:          { label: "Rejected",          cls: "bg-rose-50 text-rose-700",     dot: "bg-rose-500"    },
  out_for_delivery:  { label: "Out for Delivery",  cls: "bg-violet-50 text-violet-700", dot: "bg-violet-500"  },
  cancelled:         { label: "Cancelled",         cls: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"    },
  in_transit:        { label: "In Transit",        cls: "bg-sky-50 text-sky-700",       dot: "bg-sky-500"     },
  delivered:         { label: "Delivered",         cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  failed:            { label: "Failed",            cls: "bg-red-50 text-red-700",       dot: "bg-red-400"     },
};

async function getAuthHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : "";
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const auth = await getAuthHeader();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data;
}

function deliveryIdLabel(id: number) {
  return `DEL-${String(id).padStart(4, "0")}`;
}

function itemCount(itemStr: string): number {
  try {
    const parsed = JSON.parse(itemStr);
    if (Array.isArray(parsed)) return parsed.length;
  } catch {}
  return 1;
}

function itemLabel(itemStr: string): string {
  try {
    const parsed = JSON.parse(itemStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0]?.name ?? parsed[0]?.label ?? String(parsed[0]);
      return parsed.length > 1 ? `${first} +${parsed.length - 1}` : first;
    }
  } catch {}
  return itemStr ?? "—";
}

function getDisplayStatus(rawStatus: string): DisplayStatus {
  return toWebStatus(rawStatus) as DisplayStatus;
}

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

function formatEta(dropTime: string) {
  const d = new Date(dropTime);
  if (Number.isNaN(d.getTime())) return dropTime;
  const date = d.toLocaleDateString("en-CA");
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function formatEtaDate(dropTime: string) {
  const d = new Date(dropTime);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatValue(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) return value;
  const num = parseFloat(digits);
  if (Number.isNaN(num)) return value;
  return `KES ${num.toLocaleString("en-KE")}`;
}

function getPriority(d: PartnerDelivery): { label: string; express: boolean } {
  const hint = `${d.item} ${d.weight ?? ""} ${d.delivery_notes ?? ""}`.toLowerCase();
  if (hint.includes("express") || hint.includes("urgent")) {
    return { label: "Express", express: true };
  }
  return { label: "Standard", express: false };
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isPickup(d: PartnerDelivery) {
  const hint = `${d.item} ${d.delivery_notes ?? ""}`.toLowerCase();
  return hint.includes("pickup");
}

function computeDistanceKm(d: PartnerDelivery): number | null {
  if (!d.pickup_coordinates || !d.coordinates) return null;
  try {
    const [pLat, pLng] = parsePointCoordinates(d.pickup_coordinates as string | number[] | object);
    const [dLat, dLng] = parsePointCoordinates(d.coordinates as string | number[] | object);
    return Math.round(haversineKm(pLat, pLng, dLat, dLng) * 10) / 10;
  } catch {
    return null;
  }
}

function enrichDeliveries(
  deliveries: PartnerDelivery[],
  routeById: Map<number, PartnerRoute>,
  routeNameById: Map<number, string>
): EnrichedDelivery[] {
  return deliveries.map((d) => {
    const route = d.route_id ? routeById.get(d.route_id) : undefined;
    return {
      ...d,
      displayStatus: getDisplayStatus(d.status),
      driverName: route?.driver?.name ?? "Unassigned",
      routeName: route?.name ?? null,
      routeNameLabel: d.route_name_id ? (routeNameById.get(d.route_name_id) ?? null) : null,
      distanceKm: computeDistanceKm(d),
    };
  });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 sm:px-4 py-3 sm:py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 leading-tight truncate">
        {label}
      </p>
      <p className="mt-1.5 sm:mt-2 text-2xl font-bold leading-none text-emerald-600">{value}</p>
    </div>
  );
}

const TH =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80";
const TH_STICKY_LEFT =
  `${TH} sticky left-0 z-20 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]`;
const TH_STICKY_RIGHT =
  `${TH} sticky right-0 z-20 text-right shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.08)]`;
const TD_STICKY_LEFT =
  "px-4 py-4 align-top sticky left-0 z-10 bg-white shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]";
const TD_STICKY_RIGHT =
  "px-4 py-4 align-top sticky right-0 z-10 bg-white shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.06)]";

function DeliveriesTable({
  rows,
  actionId,
  selectedIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
  onApprove,
  onAccept,
  onReject,
  onCancel,
}: {
  rows: EnrichedDelivery[];
  actionId: number | null;
  selectedIds: Set<number>;
  onView: (d: EnrichedDelivery) => void;
  onEdit: (d: EnrichedDelivery) => void;
  onDelete: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onApprove: (id: number) => void;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateScrollState); ro.disconnect(); };
  }, [updateScrollState, rows]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    isDragging.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  };
  const stopDrag = () => { isDragging.current = false; setDragging(false); };

  const awaitingRows = rows.filter((d) => d.displayStatus === "awaiting_approval");
  const otherRows = rows.filter((d) => d.displayStatus !== "awaiting_approval");
  const hasBothGroups = awaitingRows.length > 0 && otherRows.length > 0;

  const renderRow = (d: EnrichedDelivery) => {
    const badge = STATUS_BADGE[d.displayStatus];
    const priority = getPriority(d);
    const busy = actionId === d.id;
    const editable = ["awaiting_approval", "pending", "out_for_delivery", "cancelled", "rejected"].includes(d.displayStatus);

    return (
      <tr key={d.id} className={`hover:bg-gray-50/60 transition-colors ${selectedIds.has(d.id) ? "bg-emerald-50/50" : ""}`}>
        <td className={TD_STICKY_LEFT}>
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => onToggleSelect(d.id)}
              className={`mt-0.5 flex shrink-0 items-center justify-center h-4 w-4 rounded border transition-colors ${
                selectedIds.has(d.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
              }`}
            >
              {selectedIds.has(d.id) && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div>
              <p className="font-semibold text-gray-900 whitespace-nowrap">{deliveryIdLabel(d.id)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {itemCount(d.item)} {itemCount(d.item) === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4 align-top">
          <p className="font-medium text-gray-900 whitespace-nowrap">{d.customer_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{d.phone}</p>
        </td>
        <td className="px-4 py-4 align-top max-w-[200px]">
          <p className="text-gray-700 truncate" title={d.location}>{d.location}</p>
        </td>
        <td className="px-4 py-4 align-top">
          <p className={`whitespace-nowrap ${d.driverName === "Unassigned" ? "text-gray-400 italic" : "text-gray-800"}`}>
            {d.driverName}
          </p>
        </td>
        <td className="px-4 py-4 align-top">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
            {badge.label}
          </span>
        </td>
        <td className="px-4 py-4 align-top">
          {priority.express ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 whitespace-nowrap">
              <Zap className="h-3.5 w-3.5" />Express
            </span>
          ) : (
            <span className="text-xs text-gray-500">Standard</span>
          )}
        </td>
        <td className="px-4 py-4 align-top whitespace-nowrap">
          <p className="text-gray-800">{formatEta(d.drop_time)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatEtaDate(d.drop_time)}</p>
        </td>
        <td className="px-4 py-4 align-top whitespace-nowrap">
          <p className="font-medium text-gray-900">{formatValue(d.estimated_value)}</p>
        </td>
        <td className={TD_STICKY_RIGHT}>
          <div className="flex items-center justify-end gap-0.5">
            <button type="button" onClick={() => onView(d)} title="View"
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Eye className="h-4 w-4" />
            </button>

            {d.displayStatus === "awaiting_approval" && (
              <button type="button" disabled={busy} onClick={() => onApprove(d.id)} title="Approve"
                className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {d.displayStatus === "pending" && (<>
              <button type="button" disabled={busy} onClick={() => onAccept(d.id)} title="Accept"
                className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy} onClick={() => onReject(d.id)} title="Reject"
                className="p-1.5 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40">
                <XCircle className="h-4 w-4" />
              </button>
            </>)}
            {d.displayStatus === "out_for_delivery" && (
              <button type="button" disabled={busy} onClick={() => onCancel(d.id)} title="Cancel"
                className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                <XCircle className="h-4 w-4" />
              </button>
            )}

            {(d.displayStatus === "cancelled" || d.displayStatus === "rejected") && (
              <button type="button" disabled={busy} onClick={() => onAccept(d.id)} title="Accept"
                className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {editable && (
              <button type="button" onClick={() => onEdit(d)} title="Edit"
                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => onDelete(d.id)} title="Delete"
              className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="relative">
      {/* Left scroll shadow */}
      <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-30 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${canScrollLeft ? "opacity-100" : "opacity-0"}`} />
      {/* Right scroll shadow */}
      <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-30 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 ${canScrollRight ? "opacity-100" : "opacity-0"}`} />

      <div
        ref={scrollRef}
        className={`overflow-x-auto select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className={TH_STICKY_LEFT}>Order</th>
              <th className={TH}>Customer</th>
              <th className={TH}>Drop Off</th>
              <th className={TH}>Driver</th>
              <th className={TH}>Status</th>
              <th className={TH}>Priority</th>
              <th className={TH}>ETA</th>
              <th className={TH}>Value</th>
              <th className={TH_STICKY_RIGHT}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {awaitingRows.length > 0 && (
              <>
                <tr className="bg-amber-50 border-b border-amber-100">
                  <td colSpan={9} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Awaiting Approval</span>
                      <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-amber-200 text-amber-800 text-[10px] font-bold">
                        {awaitingRows.length}
                      </span>
                    </div>
                  </td>
                </tr>
                {awaitingRows.map(renderRow)}
              </>
            )}
            {otherRows.length > 0 && (
              <>
                {hasBothGroups && (
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <td colSpan={9} className="px-4 py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">All Deliveries</span>
                    </td>
                  </tr>
                )}
                {otherRows.map(renderRow)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<PartnerDelivery[]>([]);
  const [routes, setRoutes] = useState<PartnerRoute[]>([]);
  const [routeNameMap, setRouteNameMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [pageTab, setPageTab] = useState<PageTab>("deliveries");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [viewDelivery, setViewDelivery] = useState<ViewableDelivery | null>(null);
  const [editDelivery, setEditDelivery] = useState<PartnerDelivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<{ id: number; status: DisplayStatus; label: string; description: string } | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<{ type: "status"; status: DisplayStatus; label: string } | { type: "delete" } | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState<{ id: number; payload: CreateDeliveryPayload } | null>(null);
  const { toast } = useToast();

  const routeById = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes]
  );

  const enriched = useMemo(
    () => enrichDeliveries(deliveries, routeById, routeNameMap),
    [deliveries, routeById, routeNameMap]
  );

  const routePoints = useMemo(
    () =>
      routes
        .filter((r) => r.lat && r.lng)
        .map((r) => ({ lat: r.lat, lng: r.lng })),
    [routes]
  );

  const clientOptions = useMemo(() => {
    const names = new Set<string>();
    routes.forEach((r) => {
      if (r.name?.trim()) names.add(r.name.trim());
    });
    return Array.from(names).sort();
  }, [routes]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [deliveriesData, routesData, routeNamesData] = await Promise.all([
        apiFetch("/api/deliveries"),
        apiFetch("/api/routes"),
        apiFetch("/api/route-names"),
      ]);
      setDeliveries(deliveriesData ?? []);
      setRoutes(routesData ?? []);
      const map = new Map<number, string>(
        (routeNamesData ?? []).map((r: { id: number; name: string }) => [r.id, r.name])
      );
      setRouteNameMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabSource = useMemo(() => {
    return pageTab === "pickups"
      ? enriched.filter((d) => isPickup(d))
      : enriched.filter((d) => !isPickup(d));
  }, [enriched, pageTab]);

  const stats = useMemo(() => {
    const today = tabSource.filter(
      (d) => isToday(d.drop_time) || isToday(d.created_at)
    );
    return {
      totalToday: today.length,
      awaitingApproval: tabSource.filter((d) => d.displayStatus === "awaiting_approval").length,
      outForDelivery: tabSource.filter((d) => d.displayStatus === "out_for_delivery").length,
      inTransit: tabSource.filter((d) => d.displayStatus === "in_transit").length,
      delivered: tabSource.filter((d) => d.displayStatus === "delivered").length,
      rejected: tabSource.filter((d) => d.displayStatus === "rejected").length,
      cancelled: tabSource.filter((d) => d.displayStatus === "cancelled").length,
    };
  }, [tabSource]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: tabSource.length,
      awaiting_approval: 0, pending: 0, rejected: 0,
      out_for_delivery: 0, cancelled: 0,
      in_transit: 0, delivered: 0, failed: 0,
    };
    tabSource.forEach((d) => { counts[d.displayStatus]++; });
    return counts;
  }, [tabSource]);

  const filtered = useMemo(() => {
    let list = tabSource;

    if (activeFilter !== "all") {
      list = list.filter((d) => d.displayStatus === activeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.customer_name.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          deliveryIdLabel(d.id).toLowerCase().includes(q) ||
          (d.driverName !== "Unassigned" && d.driverName.toLowerCase().includes(q))
      );
    }

    // Awaiting approval stays pinned at top (handled by table grouping).
    // Within each group sort by most recently updated first.
    return [...list].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, [tabSource, activeFilter, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const someFilteredSelected = filtered.some((d) => selectedIds.has(d.id));

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((d) => prev.has(d.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((d) => d.id));
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map((id) => apiFetch(`/api/deliveries/${id}`, { method: "DELETE" })));
      const count = selectedIds.size;
      setDeliveries((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      clearSelection();
      toast({ title: `${count} deliver${count !== 1 ? "ies" : "y"} deleted`, description: "Selected deliveries have been removed." });
    } catch (err) {
      toast({ variant: "destructive", title: "Bulk delete failed", description: err instanceof Error ? err.message : "Failed to delete selected deliveries." });
    } finally {
      setBulkProcessing(false);
    }
  };

  // Maps each bulk action to the statuses that are eligible for it
  const BULK_STATUS_ELIGIBILITY: Record<DisplayStatus, DisplayStatus[]> = {
    pending:          ["awaiting_approval"],
    out_for_delivery: ["pending", "cancelled", "rejected"],
    rejected:         ["pending"],
    cancelled:        ["out_for_delivery"],
    delivered:        ["in_transit"],
    awaiting_approval: [],
    in_transit:       [],
    failed:           [],
  };

  const handleBulkStatusChange = async (newStatus: DisplayStatus, label: string) => {
    const eligible = filtered.filter(
      (d) => selectedIds.has(d.id) && BULK_STATUS_ELIGIBILITY[newStatus].includes(d.displayStatus)
    );
    if (!eligible.length) {
      toast({ variant: "destructive", title: "No eligible deliveries", description: `None of the selected deliveries can be ${label.toLowerCase()}d.` });
      return;
    }
    setBulkProcessing(true);
    try {
      await Promise.all(eligible.map((d) => apiFetch(`/api/deliveries/${d.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) })));
      await fetchData();
      clearSelection();
      toast({ title: `${eligible.length} deliver${eligible.length !== 1 ? "ies" : "y"} ${label.toLowerCase()}d`, description: `Status updated successfully.` });
    } catch (err) {
      toast({ variant: "destructive", title: `Bulk ${label.toLowerCase()} failed`, description: err instanceof Error ? err.message : "Failed to update deliveries." });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleView = (d: EnrichedDelivery) => {
    setViewDelivery(d as ViewableDelivery);
  };

  const STATUS_TOAST: Record<DisplayStatus, string> = {
    pending:          "Approved",
    out_for_delivery: "Accepted",
    rejected:         "Rejected",
    in_transit:       "Moved to in transit",
    cancelled:        "Cancelled",
    delivered:        "Marked as delivered",
    awaiting_approval: "Reset to awaiting approval",
    failed:           "Marked as failed",
  };

  const handleStatusChange = async (id: number, newStatus: DisplayStatus) => {
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: newStatus, updated_at: new Date().toISOString() } : d
      )
    );
    setActionId(id);
    try {
      await apiFetch(`/api/deliveries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchData();
      toast({ title: `${deliveryIdLabel(id)} — ${STATUS_TOAST[newStatus]}`, description: "Delivery status updated." });
    } catch (err) {
      await fetchData();
      toast({ variant: "destructive", title: "Status update failed", description: err instanceof Error ? err.message : "Failed to update delivery status." });
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = (id: number) => setConfirmStatus({
    id, status: "pending", label: "Approve",
    description: "Do you want to approve this delivery and move it to Pending?",
  });
  const handleAccept = (id: number) => setConfirmStatus({
    id, status: "out_for_delivery", label: "Accept",
    description: "Do you want to accept this delivery and mark it as Out for Delivery?",
  });
  const handleReject = (id: number) => setConfirmStatus({
    id, status: "rejected", label: "Reject",
    description: "Do you want to reject this delivery? It can still be accepted later.",
  });
  const handleCancelDelivery = (id: number) => setConfirmStatus({
    id, status: "cancelled", label: "Cancel",
    description: "Do you want to cancel this delivery? It can still be accepted later.",
  });

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async (id: number) => {
    setConfirmDeleteId(null);
    setActionId(id);
    try {
      await apiFetch(`/api/deliveries/${id}`, { method: "DELETE" });
      setDeliveries((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      toast({ title: "Delivery deleted", description: `${deliveryIdLabel(id)} has been removed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete delivery." });
    } finally {
      setActionId(null);
    }
  };

  const handleExport = () => {
    const rows = tabSource.map((d) => ({
      id: deliveryIdLabel(d.id),
      customer: d.customer_name,
      location: d.location,
      status: STATUS_BADGE[d.displayStatus].label,
      driver: d.driverName,
      eta: formatEta(d.drop_time),
      value: d.estimated_value ?? "",
      item: d.item,
      phone: d.phone,
    }));
    const header = Object.keys(rows[0] ?? {}).join(",");
    const body = rows
      .map((r) =>
        Object.values(r)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateDelivery = async (payload: CreateDeliveryPayload) => {
    setSaving(true);
    try {
      await apiFetch("/api/deliveries", {
        method: "POST",
        body: JSON.stringify({ ...payload, status: "awaiting_approval" }),
      });
      setAddOpen(false);
      await fetchData();
      toast({ title: "Delivery created", description: `Delivery for ${payload.customer_name} has been added.` });
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDelivery = async (id: number, payload: CreateDeliveryPayload) => {
    setEditDelivery(null);
    setConfirmUpdate({ id, payload });
  };

  const executeUpdate = async () => {
    if (!confirmUpdate) return;
    const { id, payload } = confirmUpdate;
    setConfirmUpdate(null);
    setSaving(true);
    try {
      await apiFetch(`/api/deliveries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await fetchData();
      toast({ title: "Delivery updated", description: `${deliveryIdLabel(id)} has been updated.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update delivery." });
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (d: EnrichedDelivery) => {
    const badge = STATUS_BADGE[d.displayStatus];
    const priority = getPriority(d);
    const itemDisplayLabel = d.routeName ?? (d.item ? itemLabel(d.item) : "—");
    const busy = actionId === d.id;
    const editable = ["awaiting_approval", "pending", "out_for_delivery", "cancelled", "rejected"].includes(d.displayStatus);

    return (
      <div
        key={d.id}
        className="bg-white rounded-2xl shadow-sm flex flex-col"
        style={{ border: selectedIds.has(d.id) ? "1.5px solid #10B981" : "1px solid #f3f4f6" }}
      >
        {/* Card header: ID top-left, checkbox+pencil top-right, name full-width, badge below */}
        <div className="relative px-5 pt-4 pb-3">
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleDelete(d.id)}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditDelivery(d)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleSelect(d.id)}
              className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                selectedIds.has(d.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
              }`}
            >
              {selectedIds.has(d.id) && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          <span className="text-xs font-semibold text-gray-400 tracking-wide pr-8 block">
            {deliveryIdLabel(d.id)}
          </span>
          <p className="text-base font-bold text-gray-900 leading-snug mt-0.5 pr-8 truncate">
            {d.customer_name}
          </p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{d.location}</p>
          {/* Status badge on its own row */}
          <div className="mt-2.5">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
              {badge.label}
            </span>
            {priority.express && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 px-2.5 py-1 rounded-full bg-violet-50">
                <Zap className="h-3 w-3" />Express
              </span>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="border-t px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          {(
            [
              ["DRIVER", d.driverName],
              ["ETA", formatEta(d.drop_time)],
              ["VALUE", formatValue(d.estimated_value)],
              ["ITEM", itemDisplayLabel],
            ] as [string, React.ReactNode][]
          ).map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
              <div className="text-sm font-medium text-gray-800 mt-0.5 truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="border-t px-5 py-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleView(d)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />View
          </button>

          {d.displayStatus === "awaiting_approval" && (
            <button type="button" disabled={busy} onClick={() => handleApprove(d.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />Approve
            </button>
          )}
          {d.displayStatus === "pending" && (<>
            <button type="button" disabled={busy} onClick={() => handleAccept(d.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />Accept
            </button>
            <button type="button" disabled={busy} onClick={() => handleReject(d.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" />Reject
            </button>
          </>)}
          {d.displayStatus === "out_for_delivery" && (
            <button type="button" disabled={busy} onClick={() => handleCancelDelivery(d.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" />Cancel
            </button>
          )}

          {(d.displayStatus === "cancelled" || d.displayStatus === "rejected") && (
            <button type="button" disabled={busy} onClick={() => handleAccept(d.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />Accept
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="border-b bg-white px-4 sm:px-8 pt-4 pb-0">
        <p className="text-xs text-gray-400 mb-4">
          <Link href="/dashboard/analytics" className="hover:text-gray-600 transition-colors">
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600">Deliveries</span>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Track and manage all active and past deliveries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => alert("CSV import coming soon.")}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => alert("Client order link coming soon.")}
            >
              <Link2 className="h-4 w-4" />
              Client Order Link
            </Button>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                padding: "10px 20px", fontSize: 14, fontWeight: 600,
                color: "#162318", backgroundColor: "#CDF782",
                border: "none", borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Delivery
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-6 flex-1">
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
            <StatCard label="Total Today"      value={stats.totalToday} />
            <StatCard label="Awaiting Approval" value={stats.awaitingApproval} />
            <StatCard label="Out for Delivery" value={stats.outForDelivery} />
            <StatCard label="In Transit"       value={stats.inTransit} />
            <StatCard label="Delivered"        value={stats.delivered} />
            <StatCard label="Rejected"         value={stats.rejected} />
            <StatCard label="Cancelled"        value={stats.cancelled} />
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Controls: stacked rows for responsiveness */}
          <div className="px-4 py-3 border-b space-y-2.5">
            {/* Row 1: Page tabs + Search + View toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {(["deliveries", "pickups"] as PageTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPageTab(tab)}
                      className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors border"
                      style={
                        pageTab === tab
                          ? { backgroundColor: "#CDF782", color: "#162318", borderColor: "#CDF782" }
                          : { backgroundColor: "transparent", color: "#6b7280", borderColor: "#e5e7eb" }
                      }
                    >
                      {tab === "deliveries" ? "Deliveries" : "Pickups"}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search deliveries, customers, drivers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-56 sm:w-72 rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Row 2: Select-all checkbox + Filter chips */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={toggleSelectAll}
                className={`flex shrink-0 items-center justify-center h-4 w-4 rounded border transition-colors ${
                  allFilteredSelected
                    ? "border-emerald-500 bg-emerald-500"
                    : someFilteredSelected
                    ? "border-emerald-400 bg-white"
                    : "border-gray-300 bg-white hover:border-emerald-400"
                }`}
                title={allFilteredSelected ? "Deselect all" : "Select all"}
              >
                {allFilteredSelected && (
                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {someFilteredSelected && !allFilteredSelected && (
                  <div className="h-0.5 w-2 bg-emerald-500 rounded-full" />
                )}
              </button>
              <div className="h-4 w-px bg-gray-200 shrink-0" />

            {/* Filter chips — horizontally scrollable */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0"
                  style={
                    activeFilter === tab.key
                      ? { backgroundColor: "#CDF782", color: "#162318" }
                      : { color: "#6b7280" }
                  }
                  onMouseEnter={(e) => {
                    if (activeFilter !== tab.key)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    if (activeFilter !== tab.key)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                >
                  {tab.label}
                  {filterCounts[tab.key] > 0 && (
                    <span className="ml-1 text-xs opacity-60">
                      ({filterCounts[tab.key]})
                    </span>
                  )}
                </button>
              ))}
            </div>
            </div>
          </div>

          {/* Bulk action bar */}
          {someFilteredSelected && (
            <div className="px-4 py-2.5 border-t border-gray-100">
              <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2 shadow-sm text-sm">
                <span className="font-semibold text-gray-700">{selectedIds.size} selected</span>
                <div className="h-4 w-px bg-gray-200" />
                <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "status", status: "pending", label: "Approve" })}
                  className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors">
                  Approve
                </button>
                <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "status", status: "out_for_delivery", label: "Accept" })}
                  className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors">
                  Accept
                </button>
                <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "status", status: "rejected", label: "Reject" })}
                  className="font-medium text-rose-500 hover:text-rose-600 disabled:opacity-50 transition-colors">
                  Reject
                </button>
                <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "status", status: "cancelled", label: "Cancel" })}
                  className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors">
                  Cancel
                </button>
                <div className="h-4 w-px bg-gray-200" />
                <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "delete" })}
                  className="flex items-center gap-1.5 text-red-500 hover:text-red-600 font-medium disabled:opacity-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                  {bulkProcessing ? "Processing…" : "Delete"}
                </button>
                <button type="button" onClick={clearSelection} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {!loading && !error && tabSource.length > 0 && filtered.length === 0 && (
            <p className="px-5 pb-8 text-sm text-gray-500 text-center">
              No deliveries match your filters.
            </p>
          )}

          {!loading && !error && filtered.length > 0 && viewMode === "list" && (
            <div className="border-t border-gray-100">
              <DeliveriesTable
                rows={filtered}
                actionId={actionId}
                selectedIds={selectedIds}
                onView={handleView}
                onEdit={(d) => setEditDelivery(d)}
                onDelete={handleDelete}
                onToggleSelect={toggleSelect}
                onApprove={handleApprove}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancelDelivery}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading deliveries...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm font-medium text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData(); }}>
              Try again
            </Button>
          </div>
        ) : tabSource.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-2xl border border-dashed border-gray-200 bg-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Package className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">
                No {pageTab === "pickups" ? "pickups" : "deliveries"} yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {pageTab === "pickups"
                  ? "Pickups are deliveries whose item or notes mention pickup."
                  : "Create a delivery to start tracking orders across your fleet."}
              </p>
            </div>
            {pageTab === "deliveries" && (
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  padding: "10px 20px", fontSize: 14, fontWeight: 600,
                  color: "#162318", backgroundColor: "#CDF782",
                  border: "none", borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
              >
                <Plus className="h-4 w-4" />
                Add Delivery
              </button>
            )}
          </div>
        ) : viewMode === "grid" && filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-8">
            {filtered.map((d) => renderCard(d))}
          </div>
        ) : null}
      </div>

      <DeliveryViewModal
        open={viewDelivery !== null}
        onClose={() => setViewDelivery(null)}
        onEdit={(d) => {
          setViewDelivery(null);
          setEditDelivery(d);
        }}
        delivery={viewDelivery}
      />

      <AddDeliveryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreateDelivery}
        saving={saving}
        clientOptions={clientOptions}
      />

      <EditDeliveryModal
        open={editDelivery !== null}
        onClose={() => setEditDelivery(null)}
        delivery={editDelivery}
        onSubmit={handleUpdateDelivery}
        saving={saving}
        clientOptions={clientOptions}
      />

      {/* Delete confirm modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-red-600">Do you want to delete {deliveryIdLabel(confirmDeleteId)}?</h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                onClick={() => executeDelete(confirmDeleteId)}
                disabled={actionId === confirmDeleteId}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
              >
                {actionId === confirmDeleteId ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update confirm modal */}
      {confirmUpdate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmUpdate(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Do you want to save changes to {deliveryIdLabel(confirmUpdate.id)}?
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                onClick={executeUpdate}
                disabled={saving}
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
                className="flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmUpdate(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action confirm modal */}
      {confirmBulkAction !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmBulkAction(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className={`text-sm font-semibold ${confirmBulkAction.type === "delete" ? "text-red-600" : "text-gray-900"}`}>
                {confirmBulkAction.type === "delete"
                  ? `Do you want to delete ${selectedIds.size} deliver${selectedIds.size !== 1 ? "ies" : "y"}?`
                  : `Do you want to ${confirmBulkAction.label.toLowerCase()} ${selectedIds.size} deliver${selectedIds.size !== 1 ? "ies" : "y"}?`}
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={() => {
                  const action = confirmBulkAction;
                  setConfirmBulkAction(null);
                  if (action.type === "delete") {
                    handleBulkDelete();
                  } else {
                    handleBulkStatusChange(action.status, action.label);
                  }
                }}
                className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90 ${
                  confirmBulkAction.type === "delete" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                }`}
                style={confirmBulkAction.type !== "delete" ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
              >
                {bulkProcessing ? "Processing…" : confirmBulkAction.type === "delete" ? "Delete" : confirmBulkAction.label}
              </button>
              <button
                type="button"
                onClick={() => setConfirmBulkAction(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change confirm modal */}
      {confirmStatus !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmStatus(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Do you want to {confirmStatus.label.toLowerCase()} {deliveryIdLabel(confirmStatus.id)}?
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                disabled={actionId === confirmStatus.id}
                onClick={() => {
                  const { id, status } = confirmStatus;
                  setConfirmStatus(null);
                  handleStatusChange(id, status);
                }}
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
                className="flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90"
              >
                {actionId === confirmStatus.id ? "Updating…" : confirmStatus.label}
              </button>
              <button
                type="button"
                onClick={() => setConfirmStatus(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
