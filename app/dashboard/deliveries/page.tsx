"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AddDeliveryModal, {
  type CreateDeliveryPayload,
} from "@/components/add-delivery-modal";
import { supabase } from "@/lib/supabase";
import { toWebStatus } from "@/lib/deliveryStatusMapper";
import type { Database } from "@/lib/supabase";

type PartnerDelivery = Database["public"]["Tables"]["partner_deliveries"]["Row"];
type WebStatus = "pending" | "in-progress" | "completed" | "failed";

type DisplayStatus =
  | "awaiting_approval"
  | "pending"
  | "out_for_delivery"
  | "in_transit"
  | "delivered"
  | "failed";

type EnrichedDelivery = PartnerDelivery & {
  webStatus: WebStatus;
  displayStatus: DisplayStatus;
  driverName: string;
  routeName: string | null;
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
  | "in_transit"
  | "delivered"
  | "failed";

type PageTab = "deliveries" | "pickups";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting_approval", label: "Awaiting Approval" },
  { key: "pending", label: "Pending" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "failed", label: "Failed" },
];

const STATUS_BADGE: Record<DisplayStatus, { label: string; cls: string; dot: string }> = {
  awaiting_approval: {
    label: "Awaiting Approval",
    cls: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  pending: {
    label: "Pending",
    cls: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    cls: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  in_transit: {
    label: "In Transit",
    cls: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  delivered: {
    label: "Delivered",
    cls: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    cls: "bg-red-50 text-red-700",
    dot: "bg-red-400",
  },
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

function isApproved(d: PartnerDelivery) {
  return d.delivery_notes?.toLowerCase().includes("approved") ?? false;
}

function isAwaitingApproval(d: PartnerDelivery, webStatus: WebStatus) {
  return webStatus === "pending" && d.route_id == null && !isApproved(d);
}

function getDisplayStatus(d: PartnerDelivery, webStatus: WebStatus): DisplayStatus {
  if (isAwaitingApproval(d, webStatus)) return "awaiting_approval";
  if (webStatus === "failed") return "failed";
  if (webStatus === "completed") return "delivered";
  if (webStatus === "in-progress") {
    return d.route_id ? "in_transit" : "out_for_delivery";
  }
  return "pending";
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

function enrichDeliveries(
  deliveries: PartnerDelivery[],
  routeById: Map<number, PartnerRoute>
): EnrichedDelivery[] {
  return deliveries.map((d) => {
    const webStatus = toWebStatus(d.status);
    const route = d.route_id ? routeById.get(d.route_id) : undefined;
    return {
      ...d,
      status: webStatus,
      webStatus,
      displayStatus: getDisplayStatus(d, webStatus),
      driverName: route?.driver?.name ?? "Unassigned",
      routeName: route?.name ?? null,
    };
  });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-4xl font-bold text-emerald-700">{value}</p>
    </div>
  );
}

const TH =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400";

function DeliveriesTable({
  rows,
  actionId,
  onApprove,
  onDelete,
  onView,
}: {
  rows: EnrichedDelivery[];
  actionId: number | null;
  onApprove: (id: number) => void;
  onDelete: (id: number) => void;
  onView: (d: EnrichedDelivery) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className={TH}>Order</th>
            <th className={TH}>Customer</th>
            <th className={TH}>Address</th>
            <th className={TH}>Driver</th>
            <th className={TH}>Status</th>
            <th className={TH}>Priority</th>
            <th className={TH}>ETA</th>
            <th className={TH}>Value</th>
            <th className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((d) => {
            const badge = STATUS_BADGE[d.displayStatus];
            const priority = getPriority(d);
            const busy = actionId === d.id;

            return (
              <tr key={d.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-4 align-top">
                  <p className="font-semibold text-gray-900">{deliveryIdLabel(d.id)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">1 item</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="font-medium text-gray-900">{d.customer_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.phone}</p>
                </td>
                <td className="px-4 py-4 align-top max-w-[200px]">
                  <p className="text-gray-700 truncate" title={d.location}>
                    {d.location}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  <p
                    className={
                      d.driverName === "Unassigned"
                        ? "text-gray-400 italic"
                        : "text-gray-800"
                    }
                  >
                    {d.driverName}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badge.cls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-4 align-top">
                  {priority.express ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600">
                      <Zap className="h-3.5 w-3.5" />
                      Express
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Standard</span>
                  )}
                </td>
                <td className="px-4 py-4 align-top whitespace-nowrap">
                  <p className="text-gray-800">{formatEta(d.drop_time)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatEtaDate(d.drop_time)}
                  </p>
                </td>
                <td className="px-4 py-4 align-top whitespace-nowrap">
                  <p className="font-medium text-gray-900">
                    {formatValue(d.estimated_value)}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {d.displayStatus === "awaiting_approval" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onApprove(d.id)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onView(d)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Edit delivery coming soon.")}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(d.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<PartnerDelivery[]>([]);
  const [routes, setRoutes] = useState<PartnerRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [pageTab, setPageTab] = useState<PageTab>("deliveries");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const routeById = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes]
  );

  const enriched = useMemo(
    () => enrichDeliveries(deliveries, routeById),
    [deliveries, routeById]
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
      const [deliveriesData, routesData] = await Promise.all([
        apiFetch("/api/deliveries"),
        apiFetch("/api/routes"),
      ]);
      setDeliveries(deliveriesData ?? []);
      setRoutes(routesData ?? []);
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
      inTransit: tabSource.filter(
        (d) => d.displayStatus === "in_transit" || d.displayStatus === "out_for_delivery"
      ).length,
      delivered: tabSource.filter((d) => d.displayStatus === "delivered").length,
    };
  }, [tabSource]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: tabSource.length,
      awaiting_approval: 0,
      pending: 0,
      in_transit: 0,
      delivered: 0,
      failed: 0,
    };
    tabSource.forEach((d) => {
      if (d.displayStatus === "awaiting_approval") counts.awaiting_approval++;
      else if (d.displayStatus === "pending") counts.pending++;
      else if (d.displayStatus === "in_transit" || d.displayStatus === "out_for_delivery")
        counts.in_transit++;
      else if (d.displayStatus === "delivered") counts.delivered++;
      else if (d.displayStatus === "failed") counts.failed++;
    });
    return counts;
  }, [tabSource]);

  const filtered = useMemo(() => {
    let list = tabSource;
    if (activeFilter !== "all") {
      list = list.filter((d) => {
        if (activeFilter === "awaiting_approval") return d.displayStatus === "awaiting_approval";
        if (activeFilter === "pending") return d.displayStatus === "pending";
        if (activeFilter === "in_transit")
          return d.displayStatus === "in_transit" || d.displayStatus === "out_for_delivery";
        if (activeFilter === "delivered") return d.displayStatus === "delivered";
        if (activeFilter === "failed") return d.displayStatus === "failed";
        return true;
      });
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
    return list;
  }, [tabSource, activeFilter, search]);

  const handleView = (d: EnrichedDelivery) => {
    const priority = getPriority(d);
    alert(
      [
        `${deliveryIdLabel(d.id)} — ${STATUS_BADGE[d.displayStatus].label}`,
        `Customer: ${d.customer_name} (${d.phone})`,
        `Address: ${d.location}`,
        `Driver: ${d.driverName}`,
        `Item: ${d.item}`,
        `Priority: ${priority.label}`,
        `ETA: ${formatEta(d.drop_time)}`,
        `Value: ${formatValue(d.estimated_value)}`,
        d.delivery_notes ? `Notes: ${d.delivery_notes}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  };

  const handleApprove = async (id: number) => {
    setActionId(id);
    try {
      const d = deliveries.find((x) => x.id === id);
      const notes = d?.delivery_notes?.trim();
      const nextNotes = notes && !notes.toLowerCase().includes("approved")
        ? `${notes} | Approved`
        : "Approved";
      await apiFetch(`/api/deliveries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ delivery_notes: nextNotes }),
      });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve delivery");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this delivery? This cannot be undone.")) return;
    setActionId(id);
    try {
      const auth = await getAuthHeader();
      const res = await fetch(`/api/deliveries/${id}`, {
        method: "DELETE",
        headers: { Authorization: auth },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
      }
      setDeliveries((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete delivery");
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
        body: JSON.stringify({ ...payload, status: "pending" }),
      });
      setAddOpen(false);
      await fetchData();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (d: EnrichedDelivery, showApprovalActions = false) => {
    const badge = STATUS_BADGE[d.displayStatus];
    const priority = getPriority(d);
    const clientLabel = d.routeName ?? d.item ?? "—";

    return (
      <div
        key={d.id}
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col ${
          viewMode === "list" ? "md:flex-row md:items-stretch" : ""
        }`}
      >
        <div className={`flex-1 flex flex-col ${viewMode === "list" ? "min-w-0" : ""}`}>
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-gray-400 tracking-wide">
              {deliveryIdLabel(d.id)}
            </span>
            <span
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
          </div>

          <div className="px-5 pb-4">
            <p className="text-lg font-bold text-gray-900 leading-tight">{d.customer_name}</p>
            <p className="text-sm text-gray-500 mt-0.5">{d.location}</p>
            {d.displayStatus === "failed" && d.delivery_notes && (
              <p className="text-xs text-red-500 mt-1">{d.delivery_notes}</p>
            )}
          </div>

          <div className="border-t px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {[
              ["DRIVER", d.driverName],
              ["ETA", formatEta(d.drop_time)],
              ["VALUE", formatValue(d.estimated_value)],
              [
                "PRIORITY",
                priority.express ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                    <Zap className="h-3.5 w-3.5" />
                    {priority.label}
                  </span>
                ) : (
                  priority.label
                ),
              ],
              ["CLIENT", clientLabel],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  {label}
                </p>
                <div className="text-sm font-medium text-gray-800 mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {showApprovalActions && (
            <div className="border-t px-5 py-3 flex gap-2">
              <button
                type="button"
                disabled={actionId === d.id}
                onClick={() => handleApprove(d.id)}
                className="flex-1 py-2 text-xs font-bold tracking-wide rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                APPROVE
              </button>
              <button
                type="button"
                disabled={actionId === d.id}
                onClick={() => handleDelete(d.id)}
                className="flex-1 py-2 text-xs font-bold tracking-wide rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                DELETE
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="px-8 py-3 border-b bg-white">
        <p className="text-sm text-gray-400">
          <Link href="/dashboard/analytics" className="hover:text-gray-600">
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600">Deliveries</span>
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Deliveries</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track and manage all active and past deliveries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Delivery
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 flex-1">
        {!loading && !error && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Today" value={stats.totalToday} />
            <StatCard label="Awaiting Approval" value={stats.awaitingApproval} />
            <StatCard label="In Transit" value={stats.inTransit} />
            <StatCard label="Delivered" value={stats.delivered} />
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 border-b">
            <div className="flex gap-1">
              {(["deliveries", "pickups"] as PageTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPageTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    pageTab === tab
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab === "deliveries" ? "Deliveries" : "Pickups"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 pb-3">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search deliveries, customers, drivers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeFilter === tab.key
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                  {filterCounts[tab.key] > 0 && (
                    <span
                      className={`ml-1.5 text-xs ${
                        activeFilter === tab.key ? "text-white/70" : "text-gray-400"
                      }`}
                    >
                      ({filterCounts[tab.key]})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

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
                onApprove={handleApprove}
                onDelete={handleDelete}
                onView={handleView}
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
              <Button
                className="gap-2 bg-emerald-700 hover:bg-emerald-800"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Delivery
              </Button>
            )}
          </div>
        ) : viewMode === "grid" && filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-8">
            {filtered.map((d) => renderCard(d, d.displayStatus === "awaiting_approval"))}
          </div>
        ) : null}
      </div>

      <AddDeliveryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreateDelivery}
        saving={saving}
        routePoints={routePoints}
        clientOptions={clientOptions}
      />
    </div>
  );
}
