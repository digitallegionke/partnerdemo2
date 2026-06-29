"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList, Search, X, Calendar,
  Users, AlertCircle, LayoutGrid, List, Pencil, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",       label: "All" },
  { key: "pending",   label: "Pending" },
  { key: "accepted",  label: "Accepted" },
  { key: "rejected",  label: "Rejected" },
  { key: "completed", label: "Completed" },
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
  partially_allocated: "In Progress",
  fully_allocated:     "Fully Allocated",
  rejected:            "Rejected",
  cancelled:           "Cancelled",
  completed:           "Completed",
};

const EDITABLE_STATUSES = [
  { value: "pending",  label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
] as const;

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AllocationRequestsPage() {
  const [requests, setRequests]   = useState<AllocationRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<"grid" | "list">("grid");

  // Detail modal
  const [detailRequest, setDetailRequest] = useState<AllocationRequest | null>(null);

  // Edit modal
  const [editRequest, setEditRequest] = useState<AllocationRequest | null>(null);
  const [editStatus, setEditStatus]   = useState<"pending" | "accepted" | "rejected">("pending");
  const [editNotes, setEditNotes]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

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
      rejected: 0,
      completed: 0,
    };
    requests.forEach((r) => { if (r.status in c) c[r.status]++; });
    return c;
  }, [requests]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = (req: AllocationRequest) => {
    setEditRequest(req);
    const current = ["accepted", "rejected", "pending"].includes(req.status)
      ? (req.status as "pending" | "accepted" | "rejected")
      : "pending";
    setEditStatus(current);
    setEditNotes(req.provider_notes ?? "");
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editRequest) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch(`/api/requests/${editRequest.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editStatus,
          provider_notes: editNotes.trim() || null,
        }),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? { ...r, status: updated.status, provider_notes: updated.provider_notes, reviewed_at: updated.reviewed_at }
            : r
        )
      );
      setEditRequest(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/40">
      {/* Page header */}
      <div className="bg-white border-b px-5 pt-5 pb-0">
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <Link href="/dashboard/analytics" className="hover:text-gray-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Business Delivery Requests</span>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Business Delivery Requests</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Review and respond to delivery requests from businesses.
            </p>
          </div>
          <RefreshButton onClick={fetchRequests} loading={loading} />
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Stat cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { label: "Total",     value: requests.length },
              { label: "Pending",   value: tabCounts["pending"] },
              { label: "Accepted",  value: tabCounts["accepted"] },
              { label: "Completed", value: tabCounts["completed"] },
              { label: "Rejected",  value: tabCounts["rejected"] },
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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none flex-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={activeTab === tab.key ? { backgroundColor: "#162318", color: "#ffffff" } : {}}
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
                    ? "Businesses will send delivery requests here."
                    : `No ${STATUS_LABEL[activeTab]?.toLowerCase()} requests.`}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onView={() => setDetailRequest(req)}
                    onEdit={() => openEdit(req)}
                  />
                ))}
              </div>
            ) : (
              /* ── Table view ── */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {["Business", "Status", "Drivers", "Period", "Notes", ""].map((h, i) => (
                        <th key={i} className={`pb-3 pt-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 ${i === 5 ? "text-right pr-0 w-10" : "text-left"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((req) => (
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
                        {/* Drivers */}
                        <td className="py-3.5 pr-4">
                          <p className="text-sm text-gray-700 font-medium whitespace-nowrap">
                            {req.drivers_requested} requested
                          </p>
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
                        <td className="py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDetailRequest(req)}
                              title="View details"
                              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEdit(req)}
                              title="Edit status"
                              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-semibold text-lg">{detailRequest.business_name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Received {new Date(detailRequest.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={detailRequest.status} />
                <button onClick={() => setDetailRequest(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Core info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Drivers Requested</p>
                  <p className="text-lg font-bold text-gray-900">{detailRequest.drivers_requested}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Period</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(detailRequest.start_date)}</p>
                  <p className="text-xs text-gray-500">
                    {detailRequest.end_date ? `to ${formatDate(detailRequest.end_date)}` : "Open-ended"}
                  </p>
                </div>
              </div>

              {/* Business notes */}
              {detailRequest.business_notes && (() => {
                const parsed = parseNotes(detailRequest.business_notes);
                if (!parsed) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Delivery Details</p>
                    {parsed.isJson ? (
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        {parsed.entries.map(([k, v]) => (
                          <div key={k} className="flex gap-3 text-sm">
                            <span className="font-medium text-gray-600 shrink-0 min-w-[140px]">{fmtKey(k)}</span>
                            <span className="text-gray-700">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-700 italic">&ldquo;{parsed.text}&rdquo;</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Provider notes */}
              {detailRequest.provider_notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Note</p>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-700">{detailRequest.provider_notes}</p>
                  </div>
                </div>
              )}

              {/* Reviewed at */}
              {detailRequest.reviewed_at && (
                <p className="text-xs text-gray-400">
                  Last updated {new Date(detailRequest.reviewed_at).toLocaleString("en-GB", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t shrink-0 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDetailRequest(null)}>
                Close
              </Button>
              <Button
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
                className="flex-1 hover:opacity-90 transition-opacity"
                onClick={() => { setDetailRequest(null); openEdit(detailRequest); }}
              >
                Edit Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Status Modal ─────────────────────────────────────────────────── */}
      {editRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-lg">Edit Request</h3>
                <p className="text-sm text-gray-500 mt-0.5">{editRequest.business_name}</p>
              </div>
              <button onClick={() => setEditRequest(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Request summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium text-gray-900">{editRequest.drivers_requested}</span>{" "}
                  driver{editRequest.drivers_requested !== 1 ? "s" : ""} requested
                </p>
                <p className="text-gray-600">
                  From {formatDate(editRequest.start_date)}
                  {editRequest.end_date ? ` to ${formatDate(editRequest.end_date)}` : " (open-ended)"}
                </p>
                {(() => {
                  const parsed = parseNotes(editRequest.business_notes);
                  if (!parsed) return null;
                  if (parsed.isJson) {
                    return (
                      <div className="mt-2 border-t border-gray-200 pt-2 space-y-1">
                        {parsed.entries.map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-sm">
                            <span className="font-medium text-gray-600 shrink-0">{fmtKey(k)}:</span>
                            <span className="text-gray-500">{v}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return <p className="text-gray-500 italic mt-1">&ldquo;{parsed.text}&rdquo;</p>;
                })()}
              </div>

              {/* Status dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Status
                </label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "pending" | "accepted" | "rejected")}
                >
                  {EDITABLE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes to business <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  rows={3}
                  placeholder="Add a note for the business…"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {saveError}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditRequest(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
                className="flex-1 hover:opacity-90 transition-opacity"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
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
  onView,
  onEdit,
}: {
  req: AllocationRequest;
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{req.business_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Received {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onView}
              title="View details"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={onEdit}
              title="Edit request"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>
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

      {/* Provider note */}
      {req.provider_notes && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400">
            Your note: <span className="text-gray-600">{req.provider_notes}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
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
