"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList, Search, X, User, Calendar, CheckCircle2,
  XCircle, ChevronRight, Users, AlertCircle,
  Plus, Trash2, RefreshCw, LayoutGrid, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus =
  | "pending"
  | "accepted"
  | "partially_allocated"
  | "fully_allocated"
  | "rejected"
  | "cancelled"
  | "completed";

type AllocationRequest = {
  id: number;
  business_id: number;
  business_name: string;
  service_provider_id: number;
  drivers_requested: number;
  allocated_count: number;
  start_date: string;
  end_date: string | null;
  status: RequestStatus;
  notes: string | null;
  business_notes: string | null;
  provider_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type DriverAllocation = {
  id: number;
  request_id: number;
  driver_id: number;
  vehicle_id: number | null;
  status: string;
  allocated_from: string;
  allocated_until: string | null;
  allocation_notes: string | null;
  driver: { id: number; full_name: string; phone_number: string; status: string } | null;
  vehicle: { id: number; plate_number: string; vehicle_type: string } | null;
};

type Driver = {
  id: number;
  full_name: string;
  phone_number: string;
  status: string;
  license_type: string;
};

type Vehicle = {
  id: number;
  plate_number: string;
  vehicle_type: string;
  status: string;
  assigned_driver_id: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",                label: "All" },
  { key: "pending",            label: "Pending" },
  { key: "accepted",           label: "Accepted" },
  { key: "partially_allocated", label: "In Progress" },
  { key: "fully_allocated",    label: "Fully Allocated" },
  { key: "rejected",           label: "Rejected" },
  { key: "completed",          label: "Completed" },
];

const STATUS_STYLE: Record<string, string> = {
  pending:             "bg-amber-50 text-amber-700",
  accepted:            "bg-blue-50 text-blue-700",
  partially_allocated: "bg-indigo-50 text-indigo-700",
  fully_allocated:     "bg-emerald-50 text-emerald-700",
  rejected:            "bg-red-50 text-red-700",
  cancelled:           "bg-gray-100 text-gray-500",
  completed:           "bg-gray-100 text-gray-600",
};

const STATUS_DOT: Record<string, string> = {
  pending:             "bg-amber-400",
  accepted:            "bg-blue-500",
  partially_allocated: "bg-indigo-500",
  fully_allocated:     "bg-emerald-500",
  rejected:            "bg-red-400",
  cancelled:           "bg-gray-400",
  completed:           "bg-gray-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending:             "Pending",
  accepted:            "Accepted",
  partially_allocated: "Partially Allocated",
  fully_allocated:     "Fully Allocated",
  rejected:            "Rejected",
  cancelled:           "Cancelled",
  completed:           "Completed",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

function parseNotes(notes: string | null): { isJson: true; entries: [string, string][] } | { isJson: false; text: string } | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { isJson: true, entries: Object.entries(parsed).map(([k, v]) => [k, String(v)]) };
    }
  } catch {}
  return { isJson: false, text: notes };
}

function fmtKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AllocationRequestsPage() {
  const [requests, setRequests]   = useState<AllocationRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<"grid" | "list">("grid");

  // Review modal (accept / reject)
  const [reviewRequest, setReviewRequest]     = useState<AllocationRequest | null>(null);
  const [reviewAction, setReviewAction]       = useState<"accept" | "reject" | null>(null);
  const [providerNotes, setProviderNotes]     = useState("");
  const [reviewing, setReviewing]             = useState(false);
  const [reviewError, setReviewError]         = useState<string | null>(null);

  // Allocate drivers modal
  const [allocateRequest, setAllocateRequest]     = useState<AllocationRequest | null>(null);
  const [allocations, setAllocations]             = useState<DriverAllocation[]>([]);
  const [availableDrivers, setAvailableDrivers]   = useState<Driver[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [selectedDriver, setSelectedDriver]       = useState("");
  const [selectedVehicle, setSelectedVehicle]     = useState("");
  const [allocNotes, setAllocNotes]               = useState("");
  const [allocating, setAllocating]               = useState(false);
  const [allocError, setAllocError]               = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRequests = async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? requests : requests.filter((r) => r.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.business_name.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, activeTab, search]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: requests.length,
      pending: 0,
      accepted: 0,
      partially_allocated: 0,
      fully_allocated: 0,
      rejected: 0,
      completed: 0,
    };
    requests.forEach((r) => { if (r.status in c) c[r.status]++; });
    return c;
  }, [requests]);

  // ── Review (accept / reject) ───────────────────────────────────────────────

  const openReview = (req: AllocationRequest, action: "accept" | "reject") => {
    setReviewRequest(req);
    setReviewAction(action);
    setProviderNotes("");
    setReviewError(null);
  };

  const handleReview = async () => {
    if (!reviewRequest || !reviewAction) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const updated = await apiFetch(`/api/requests/${reviewRequest.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: reviewAction === "accept" ? "accepted" : "rejected",
          provider_notes: providerNotes.trim() || null,
        }),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? { ...r, status: updated.status, provider_notes: updated.provider_notes, reviewed_at: updated.reviewed_at }
            : r
        )
      );
      setReviewRequest(null);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setReviewing(false);
    }
  };

  // ── Allocate drivers ───────────────────────────────────────────────────────

  const openAllocate = async (req: AllocationRequest) => {
    setAllocateRequest(req);
    setSelectedDriver("");
    setSelectedVehicle("");
    setAllocNotes("");
    setAllocError(null);
    setLoadingAllocations(true);
    try {
      const [allocs, drivers, vehicles] = await Promise.all([
        apiFetch(`/api/requests/${req.id}/allocations`),
        apiFetch("/api/drivers"),
        apiFetch("/api/fleet"),
      ]);
      setAllocations(Array.isArray(allocs) ? allocs : []);
      setAvailableDrivers(Array.isArray(drivers) ? drivers : []);
      setAvailableVehicles(Array.isArray(vehicles) ? vehicles : []);
    } catch {
      setAllocError("Failed to load allocation data");
    } finally {
      setLoadingAllocations(false);
    }
  };

  const handleAddAllocation = async () => {
    if (!allocateRequest || !selectedDriver) {
      setAllocError("Please select a driver.");
      return;
    }
    setAllocating(true);
    setAllocError(null);
    try {
      const created = await apiFetch(`/api/requests/${allocateRequest.id}/allocations`, {
        method: "POST",
        body: JSON.stringify({
          driver_id: parseInt(selectedDriver),
          vehicle_id: selectedVehicle ? parseInt(selectedVehicle) : null,
          allocation_notes: allocNotes.trim() || null,
        }),
      });
      setAllocations((prev) => [created, ...prev]);
      setSelectedDriver("");
      setSelectedVehicle("");
      setAllocNotes("");
      // Refresh request to get updated status and count
      const updated = await apiFetch("/api/requests");
      setRequests(Array.isArray(updated) ? updated : []);
      const refreshed = (Array.isArray(updated) ? updated : []).find(
        (r: AllocationRequest) => r.id === allocateRequest.id
      );
      if (refreshed) setAllocateRequest(refreshed);
    } catch (err) {
      setAllocError(err instanceof Error ? err.message : "Failed to allocate driver");
    } finally {
      setAllocating(false);
    }
  };

  const handleRemoveAllocation = async (allocationId: number) => {
    if (!allocateRequest) return;
    try {
      await apiFetch(
        `/api/requests/${allocateRequest.id}/allocations?allocation_id=${allocationId}`,
        { method: "DELETE" }
      );
      setAllocations((prev) => prev.filter((a) => a.id !== allocationId));
      const updated = await apiFetch("/api/requests");
      setRequests(Array.isArray(updated) ? updated : []);
      const refreshed = (Array.isArray(updated) ? updated : []).find(
        (r: AllocationRequest) => r.id === allocateRequest.id
      );
      if (refreshed) setAllocateRequest(refreshed);
    } catch {
      setAllocError("Failed to remove allocation");
    }
  };

  // ── Drivers already allocated (exclude from dropdown) ─────────────────────
  const allocatedDriverIds = new Set(
    allocations.filter((a) => a.status !== "cancelled").map((a) => a.driver_id)
  );
  const driversToShow = availableDrivers.filter((d) => !allocatedDriverIds.has(d.id));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/40">
      {/* Page header */}
      <div className="bg-white border-b px-8 pt-5 pb-0">
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <Link href="/dashboard/analytics" className="hover:text-gray-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Business Delivery Requests</span>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Business Delivery Requests</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Review requests and assign available partner drivers and vehicles.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); fetchRequests(); }}
            className="gap-2 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stat cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: "Total",           value: requests.length },
              { label: "Pending",         value: tabCounts["pending"] },
              { label: "Accepted",        value: tabCounts["accepted"] },
              { label: "In Progress",     value: tabCounts["partially_allocated"] },
              { label: "Fully Allocated", value: tabCounts["fully_allocated"] },
              { label: "Completed",       value: tabCounts["completed"] },
              { label: "Rejected",        value: tabCounts["rejected"] },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 truncate">{label}</p>
                <p className="mt-2 text-2xl font-bold leading-none text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cards area */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Tabs + search */}
          <div className="px-4 py-3 border-b space-y-3">
            {/* Search — full width on its own row */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                placeholder="Search by business name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Tabs + view toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none flex-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={activeTab === tab.key ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === tab.key
                        ? ""
                        : "border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {tab.label}
                    {tabCounts[tab.key] > 0 && (
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        activeTab === tab.key ? "opacity-60" : "bg-gray-100 text-gray-600"
                      }`}>
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                <ClipboardList className="h-12 w-12 mb-4 text-gray-300" />
                <p className="text-base font-medium">No requests found</p>
                <p className="text-sm mt-1">
                  {search
                    ? "Try a different search term."
                    : activeTab === "all"
                    ? "Businesses will send allocation requests here."
                    : `No ${STATUS_LABEL[activeTab]?.toLowerCase()} requests.`}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onAccept={() => openReview(req, "accept")}
                    onReject={() => openReview(req, "reject")}
                    onAllocate={() => openAllocate(req)}
                  />
                ))}
              </div>
            ) : (
              /* ── Table view ── */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {["Business", "Status", "Drivers", "Period", "Notes", "Actions"].map((h, i) => (
                        <th key={h} className={`pb-3 pt-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 ${i === 5 ? "text-right pr-0" : "text-left"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((req) => {
                      const isPending     = req.status === "pending";
                      const isAllocatable = ["accepted", "partially_allocated"].includes(req.status);
                      const progress      = req.drivers_requested > 0
                        ? Math.min((req.allocated_count / req.drivers_requested) * 100, 100)
                        : 0;
                      return (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          {/* Business */}
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                <ClipboardList className="h-4 w-4 text-indigo-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{req.business_name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Received {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="py-3.5 pr-4">
                            <StatusBadge status={req.status} />
                          </td>
                          {/* Drivers + progress */}
                          <td className="py-3.5 pr-4">
                            <p className="text-sm text-gray-700 font-medium whitespace-nowrap">
                              {req.allocated_count} / {req.drivers_requested}
                            </p>
                            {["partially_allocated", "fully_allocated", "accepted"].includes(req.status) && (
                              <div className="mt-1 h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            )}
                          </td>
                          {/* Period */}
                          <td className="py-3.5 pr-4 text-sm text-gray-600 whitespace-nowrap">
                            {formatDate(req.start_date)}
                            {req.end_date
                              ? <span> → {formatDate(req.end_date)}</span>
                              : <span className="text-gray-400 ml-1">(open)</span>}
                          </td>
                          {/* Notes */}
                          <td className="py-3.5 pr-4 max-w-[200px]">
                            {(() => {
                              const parsed = parseNotes(req.business_notes);
                              if (!parsed) return <span className="text-gray-300 text-sm">—</span>;
                              if (parsed.isJson) {
                                return (
                                  <div className="space-y-0.5">
                                    {parsed.entries.slice(0, 2).map(([k, v]) => (
                                      <p key={k} className="text-xs text-gray-500 truncate">
                                        <span className="font-medium text-gray-600">{fmtKey(k)}:</span> {v}
                                      </p>
                                    ))}
                                    {parsed.entries.length > 2 && (
                                      <p className="text-xs text-gray-400">+{parsed.entries.length - 2} more</p>
                                    )}
                                  </div>
                                );
                              }
                              return <p className="text-xs text-gray-500 italic truncate">{parsed.text}</p>;
                            })()}
                          </td>
                          {/* Actions */}
                          <td className="py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <button onClick={() => openReview(req, "reject")} title="Reject"
                                    className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => openReview(req, "accept")} title="Accept"
                                    className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {isAllocatable && (
                                <button onClick={() => openAllocate(req)} title="Assign Drivers"
                                  className="p-1.5 rounded text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors">
                                  <User className="h-4 w-4" />
                                </button>
                              )}
                              {req.status === "fully_allocated" && (
                                <button onClick={() => openAllocate(req)} title="View Allocations"
                                  className="p-1.5 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                  <Users className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-4 text-xs text-gray-400">
                  {filtered.length} request{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Review Modal ──────────────────────────────────────────────────────── */}
      {reviewRequest && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">
                {reviewAction === "accept" ? "Accept Request" : "Reject Request"}
              </h3>
              <button onClick={() => setReviewRequest(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-900">{reviewRequest.business_name}</p>
                <p className="text-gray-600">
                  {reviewRequest.drivers_requested} driver{reviewRequest.drivers_requested !== 1 ? "s" : ""} requested
                </p>
                <p className="text-gray-600">
                  From {formatDate(reviewRequest.start_date)}
                  {reviewRequest.end_date ? ` to ${formatDate(reviewRequest.end_date)}` : " (open-ended)"}
                </p>
                {reviewRequest.business_notes && (
                  <p className="text-gray-500 italic">&ldquo;{reviewRequest.business_notes}&rdquo;</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes to business <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  rows={3}
                  placeholder={
                    reviewAction === "accept"
                      ? "Any notes for the business…"
                      : "Reason for rejection…"
                  }
                  value={providerNotes}
                  onChange={(e) => setProviderNotes(e.target.value)}
                />
              </div>

              {reviewError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {reviewError}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setReviewRequest(null)}
                disabled={reviewing}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 ${
                  reviewAction === "accept"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                } text-white`}
                onClick={handleReview}
                disabled={reviewing}
              >
                {reviewing
                  ? "Saving…"
                  : reviewAction === "accept"
                  ? "Accept Request"
                  : "Reject Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocate Drivers Modal ─────────────────────────────────────────────── */}
      {allocateRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-semibold text-lg">Allocate Drivers</h3>
                <p className="text-sm text-gray-500">{allocateRequest.business_name}</p>
              </div>
              <button onClick={() => setAllocateRequest(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Request summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-900">{allocateRequest.drivers_requested}</span> driver{allocateRequest.drivers_requested !== 1 ? "s" : ""} requested
                  </p>
                  <p className="text-gray-500">
                    {formatDate(allocateRequest.start_date)}
                    {allocateRequest.end_date ? ` – ${formatDate(allocateRequest.end_date)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-900">{allocateRequest.allocated_count}</span> / {allocateRequest.drivers_requested} allocated
                  </p>
                  <StatusBadge status={allocateRequest.status} />
                </div>
              </div>

              {/* Current allocations */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Assigned Drivers</h4>
                {loadingAllocations ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : allocations.filter((a) => a.status !== "cancelled").length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No drivers assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {allocations
                      .filter((a) => a.status !== "cancelled")
                      .map((alloc) => (
                        <div
                          key={alloc.id}
                          className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {alloc.driver?.full_name ?? "Unknown Driver"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {alloc.driver?.phone_number ?? ""}
                                {alloc.vehicle && (
                                  <span className="ml-2">
                                    · {alloc.vehicle.plate_number} ({alloc.vehicle.vehicle_type})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveAllocation(alloc.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove allocation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Add driver form */}
              {allocateRequest.allocated_count < allocateRequest.drivers_requested && (
                <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">Add Driver</h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Driver *</label>
                      <select
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={selectedDriver}
                        onChange={(e) => setSelectedDriver(e.target.value)}
                      >
                        <option value="">Select driver…</option>
                        {driversToShow.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name} ({d.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle (optional)</label>
                      <select
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                      >
                        <option value="">No vehicle</option>
                        {availableVehicles
                          .filter((v) => v.status !== "in_maintenance")
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.plate_number} – {v.vehicle_type}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Any notes for this allocation…"
                      value={allocNotes}
                      onChange={(e) => setAllocNotes(e.target.value)}
                    />
                  </div>

                  {allocError && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {allocError}
                    </p>
                  )}

                  <Button
                    size="sm"
                    onClick={handleAddAllocation}
                    disabled={allocating || !selectedDriver}
                    className="gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {allocating ? "Assigning…" : "Assign Driver"}
                  </Button>
                </div>
              )}

              {allocateRequest.allocated_count >= allocateRequest.drivers_requested && (
                <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 rounded-xl p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  All requested drivers have been allocated.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t shrink-0">
              <Button variant="outline" className="w-full" onClick={() => setAllocateRequest(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onAccept,
  onReject,
  onAllocate,
}: {
  req: AllocationRequest;
  onAccept: () => void;
  onReject: () => void;
  onAllocate: () => void;
}) {
  const isPending   = req.status === "pending";
  const isAllocatable = ["accepted", "partially_allocated"].includes(req.status);
  const progress = req.drivers_requested > 0
    ? Math.min((req.allocated_count / req.drivers_requested) * 100, 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{req.business_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Received {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        {/* Badge — on its own row, never overlaps */}
        <div className="mt-2.5">
          <StatusBadge status={req.status} />
        </div>
      </div>

      {/* Details */}
      <div className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4 text-gray-400 shrink-0" />
          <span>{req.drivers_requested} driver{req.drivers_requested !== 1 ? "s" : ""} requested</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
          <span>
            From {formatDate(req.start_date)}
            {req.end_date ? ` to ${formatDate(req.end_date)}` : " (open-ended)"}
          </span>
        </div>
        {(() => {
          const parsed = parseNotes(req.business_notes);
          if (!parsed) return null;
          if (parsed.isJson) {
            return (
              <div className="border-l-2 border-gray-200 pl-2 space-y-0.5">
                {parsed.entries.slice(0, 3).map(([k, v]) => (
                  <p key={k} className="text-xs text-gray-500">
                    <span className="font-medium text-gray-600">{fmtKey(k)}:</span> {v}
                  </p>
                ))}
                {parsed.entries.length > 3 && (
                  <p className="text-xs text-gray-400">+{parsed.entries.length - 3} more</p>
                )}
              </div>
            );
          }
          return (
            <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 line-clamp-2">
              &ldquo;{parsed.text}&rdquo;
            </p>
          );
        })()}
      </div>

      {/* Allocation progress bar (for in-progress states) */}
      {["partially_allocated", "fully_allocated", "accepted"].includes(req.status) && (
        <div className="px-5 pb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{req.allocated_count} assigned</span>
            <span>{req.drivers_requested} needed</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {req.provider_notes && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-400">Your note: <span className="text-gray-600">{req.provider_notes}</span></p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2 mt-auto">
        {isPending && (
          <>
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50 transition-colors"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <button
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-emerald-600 rounded-lg py-2 hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> Accept
            </button>
          </>
        )}
        {isAllocatable && (
          <button
            onClick={onAllocate}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-indigo-600 rounded-lg py-2 hover:bg-indigo-700 transition-colors"
          >
            <User className="h-4 w-4" /> Assign Drivers
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        {req.status === "fully_allocated" && (
          <button
            onClick={onAllocate}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50 transition-colors"
          >
            <Users className="h-4 w-4" /> View Allocations
          </button>
        )}
        {req.status === "rejected" && (
          <span className="flex-1 text-center text-xs text-gray-400 py-2">
            Reviewed {req.reviewed_at ? formatDate(req.reviewed_at) : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
        STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          STATUS_DOT[status] ?? "bg-gray-400"
        }`}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
