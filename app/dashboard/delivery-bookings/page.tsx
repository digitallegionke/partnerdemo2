"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  Download,
  LayoutGrid,
  List,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  Users,
  Calendar,
  RefreshCw,
  Link2,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { RefreshButton } from "@/components/ui/refresh-button";
import NewBusinessDeliveryModal from "@/components/new-business-delivery-modal";
import type { CreateDeliveryPayload } from "@/components/add-delivery-modal";

type RequestStatus =
  | "pending"
  | "accepted"
  | "partially_allocated"
  | "fully_allocated"
  | "rejected"
  | "cancelled"
  | "completed";

type FilterKey = "all" | RequestStatus;

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
  updated_at: string;
};

type Business = { id: number; name: string };

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all",                label: "All" },
  { key: "pending",            label: "Pending" },
  { key: "accepted",           label: "Accepted" },
  { key: "partially_allocated", label: "In Progress" },
  { key: "fully_allocated",    label: "Fully Allocated" },
  { key: "rejected",           label: "Rejected" },
  { key: "cancelled",          label: "Cancelled" },
  { key: "completed",          label: "Completed" },
];

const STATUS_BADGE: Record<RequestStatus, { label: string; cls: string; dot: string }> = {
  pending:             { label: "Pending",         cls: "bg-amber-50 text-amber-700",     dot: "bg-amber-400"   },
  accepted:            { label: "Accepted",        cls: "bg-blue-50 text-blue-700",       dot: "bg-blue-500"    },
  partially_allocated: { label: "In Progress",     cls: "bg-indigo-50 text-indigo-700",   dot: "bg-indigo-500"  },
  fully_allocated:     { label: "Fully Allocated", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  rejected:            { label: "Rejected",        cls: "bg-rose-50 text-rose-700",       dot: "bg-rose-500"    },
  cancelled:           { label: "Cancelled",       cls: "bg-gray-100 text-gray-500",      dot: "bg-gray-400"    },
  completed:           { label: "Completed",       cls: "bg-gray-100 text-gray-600",      dot: "bg-gray-500"    },
};

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
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

function requestIdLabel(id: number) {
  return `REQ-${String(id).padStart(4, "0")}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-CA");
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

function RequestsTable({
  rows,
  actionId,
  selectedIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
  onAccept,
  onReject,
  onComplete,
  onCancel,
}: {
  rows: AllocationRequest[];
  actionId: number | null;
  selectedIds: Set<number>;
  onView: (r: AllocationRequest) => void;
  onEdit: (r: AllocationRequest) => void;
  onDelete: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onComplete: (id: number) => void;
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

  const pendingRows = rows.filter((r) => r.status === "pending");
  const otherRows = rows.filter((r) => r.status !== "pending");
  const hasBothGroups = pendingRows.length > 0 && otherRows.length > 0;

  const renderRow = (r: AllocationRequest) => {
    const badge = STATUS_BADGE[r.status];
    const busy = actionId === r.id;

    return (
      <tr key={r.id} className={`hover:bg-gray-50/60 transition-colors ${selectedIds.has(r.id) ? "bg-emerald-50/50" : ""}`}>
        <td className={TD_STICKY_LEFT}>
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => onToggleSelect(r.id)}
              className={`mt-0.5 flex shrink-0 items-center justify-center h-4 w-4 rounded border transition-colors ${
                selectedIds.has(r.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
              }`}
            >
              {selectedIds.has(r.id) && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div>
              <p className="font-semibold text-gray-900 whitespace-nowrap">{requestIdLabel(r.id)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.created_at)}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4 align-top">
          <p className="font-medium text-gray-900 whitespace-nowrap">{r.business_name}</p>
        </td>
        <td className="px-4 py-4 align-top">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="font-medium text-gray-800">{r.drivers_requested}</span>
            {r.allocated_count > 0 && (
              <span className="text-xs text-gray-400">/ {r.allocated_count} allocated</span>
            )}
          </div>
        </td>
        <td className="px-4 py-4 align-top">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
            {badge.label}
          </span>
        </td>
        <td className="px-4 py-4 align-top whitespace-nowrap">
          <div className="flex items-center gap-1 text-gray-700">
            <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {formatDate(r.start_date)}
          </div>
        </td>
        <td className="px-4 py-4 align-top whitespace-nowrap">
          <p className="text-gray-600">{formatDate(r.end_date)}</p>
        </td>
        <td className="px-4 py-4 align-top max-w-[200px]">
          <p className="text-gray-600 truncate text-sm" title={r.notes ?? ""}>{r.notes ?? "—"}</p>
        </td>
        <td className={TD_STICKY_RIGHT}>
          <div className="flex items-center justify-end gap-0.5">
            <button type="button" onClick={() => onView(r)} title="View"
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Eye className="h-4 w-4" />
            </button>
            {r.status === "pending" && (<>
              <button type="button" disabled={busy} onClick={() => onAccept(r.id)} title="Accept"
                className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy} onClick={() => onReject(r.id)} title="Reject"
                className="p-1.5 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40">
                <XCircle className="h-4 w-4" />
              </button>
            </>)}
            {(r.status === "accepted" || r.status === "partially_allocated" || r.status === "fully_allocated") && (<>
              <button type="button" disabled={busy} onClick={() => onComplete(r.id)} title="Complete"
                className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy} onClick={() => onCancel(r.id)} title="Cancel"
                className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                <XCircle className="h-4 w-4" />
              </button>
            </>)}
            {(r.status === "rejected" || r.status === "cancelled") && (
              <button type="button" disabled={busy} onClick={() => onAccept(r.id)} title="Re-Accept"
                className="p-1.5 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => onEdit(r)} title="Edit"
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" disabled={busy} onClick={() => onDelete(r.id)} title="Delete"
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
      <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-30 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${canScrollLeft ? "opacity-100" : "opacity-0"}`} />
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
              <th className={TH_STICKY_LEFT}>Request</th>
              <th className={TH}>Business</th>
              <th className={TH}>Drivers</th>
              <th className={TH}>Status</th>
              <th className={TH}>Start Date</th>
              <th className={TH}>End Date</th>
              <th className={TH}>Notes</th>
              <th className={TH_STICKY_RIGHT}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pendingRows.length > 0 && (
              <>
                <tr className="bg-amber-50 border-b border-amber-100">
                  <td colSpan={8} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Pending Review</span>
                      <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-amber-200 text-amber-800 text-[10px] font-bold">
                        {pendingRows.length}
                      </span>
                    </div>
                  </td>
                </tr>
                {pendingRows.map(renderRow)}
              </>
            )}
            {otherRows.length > 0 && (
              <>
                {hasBothGroups && (
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <td colSpan={8} className="px-4 py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">All Requests</span>
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

function ViewRequestModal({
  request,
  onClose,
  onEdit,
}: {
  request: AllocationRequest | null;
  onClose: () => void;
  onEdit: (r: AllocationRequest) => void;
}) {
  if (!request) return null;
  const badge = STATUS_BADGE[request.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{requestIdLabel(request.id)}</p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">{request.business_name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
              {badge.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Drivers Requested</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{request.drivers_requested}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Allocated</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{request.allocated_count}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Start Date</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(request.start_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">End Date</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(request.end_date)}</p>
            </div>
          </div>
          {(request.notes || request.business_notes) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Notes</p>
              <p className="mt-1 text-sm text-gray-700">{request.notes ?? request.business_notes}</p>
            </div>
          )}
          {request.provider_notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Provider Notes</p>
              <p className="mt-1 text-sm text-gray-700">{request.provider_notes}</p>
            </div>
          )}
          {request.reviewed_at && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Reviewed At</p>
              <p className="mt-1 text-sm text-gray-700">{formatDate(request.reviewed_at)}</p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={() => { onClose(); onEdit(request); }}
            style={{ backgroundColor: "#CDF782", color: "#162318" }}
            className="flex-1 rounded-xl text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity"
          >
            Edit
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestFormModal({
  open,
  onClose,
  onSubmit,
  saving,
  businesses,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { business_id?: number; drivers_requested: number; start_date: string; end_date: string; notes: string; provider_notes: string }) => void;
  saving: boolean;
  businesses: Business[];
  initialData?: AllocationRequest | null;
}) {
  const isEdit = !!initialData;
  const [businessId, setBusinessId] = useState<string>(initialData ? String(initialData.business_id) : "");
  const [driversRequested, setDriversRequested] = useState<string>(initialData ? String(initialData.drivers_requested) : "1");
  const [startDate, setStartDate] = useState<string>(initialData?.start_date?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState<string>(initialData?.end_date?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState<string>(initialData?.notes ?? "");
  const [providerNotes, setProviderNotes] = useState<string>(initialData?.provider_notes ?? "");

  useEffect(() => {
    if (open && initialData) {
      setBusinessId(String(initialData.business_id));
      setDriversRequested(String(initialData.drivers_requested));
      setStartDate(initialData.start_date?.slice(0, 10) ?? "");
      setEndDate(initialData.end_date?.slice(0, 10) ?? "");
      setNotes(initialData.notes ?? "");
      setProviderNotes(initialData.provider_notes ?? "");
    } else if (open && !initialData) {
      setBusinessId("");
      setDriversRequested("1");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setProviderNotes("");
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...(isEdit ? {} : { business_id: Number(businessId) }),
      drivers_requested: Number(driversRequested),
      start_date: startDate,
      end_date: endDate,
      notes,
      provider_notes: providerNotes,
    });
  };

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? `Edit ${requestIdLabel(initialData!.id)}` : "New Business Delivery"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Business <span className="text-red-500">*</span>
              </label>
              {businesses.length > 0 ? (
                <select
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select a business…</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  placeholder="Business ID"
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  required
                  className={inputCls}
                />
              )}
            </div>
          )}
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business</label>
              <p className="text-sm text-gray-700 font-medium">{initialData!.business_name}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Drivers Requested <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={driversRequested}
              onChange={(e) => setDriversRequested(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes…"
              className={`${inputCls} resize-none`}
            />
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Provider Notes</label>
              <textarea
                value={providerNotes}
                onChange={(e) => setProviderNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes…"
                className={`${inputCls} resize-none`}
              />
            </div>
          )}
          <div className="pt-1 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: "#CDF782", color: "#162318" }}
              className="flex-1 rounded-xl text-sm font-semibold py-2.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Request")}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const BULK_ACCEPT_ELIGIBLE: RequestStatus[] = ["pending", "rejected", "cancelled"];
const BULK_REJECT_ELIGIBLE: RequestStatus[] = ["pending"];
const BULK_CANCEL_ELIGIBLE: RequestStatus[] = ["accepted", "partially_allocated", "fully_allocated"];
const BULK_COMPLETE_ELIGIBLE: RequestStatus[] = ["accepted", "partially_allocated", "fully_allocated"];

export default function BusinessDeliveriesPage() {
  const [requests, setRequests] = useState<AllocationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [viewRequest, setViewRequest] = useState<AllocationRequest | null>(null);
  const [editRequest, setEditRequest] = useState<AllocationRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<{ id: number; status: RequestStatus; label: string; description: string } | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<{ type: "status"; status: RequestStatus; label: string } | { type: "delete" } | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState<{ id: number; payload: Record<string, unknown> } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [provider, setProvider] = useState<{ provider_name?: string; legal_name?: string; contact_email?: string; contact_phone?: string; city?: string; country?: string } | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/requests");
      setRequests(data ?? []);
      // Extract unique businesses from the data
      const bizMap = new Map<number, string>();
      (data ?? []).forEach((r: AllocationRequest) => {
        if (!bizMap.has(r.business_id)) bizMap.set(r.business_id, r.business_name);
      });
      setBusinesses(Array.from(bizMap.entries()).map(([id, name]) => ({ id, name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load business deliveries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("partner_provider_users").select("provider_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!membership) return;
      const pid = (membership as { provider_id: number }).provider_id;
      setProviderId(pid);
      const { data: prov } = await supabase
        .from("partner_providers").select("provider_name,legal_name,contact_email,contact_phone,city,country")
        .eq("id", pid).single();
      if (prov) setProvider(prov);
    })();
  }, []);

  const stats = useMemo(() => ({
    total:            requests.length,
    pending:          requests.filter((r) => r.status === "pending").length,
    accepted:         requests.filter((r) => r.status === "accepted").length,
    inProgress:       requests.filter((r) => r.status === "partially_allocated").length,
    fullyAllocated:   requests.filter((r) => r.status === "fully_allocated").length,
    rejected:         requests.filter((r) => r.status === "rejected").length,
    completed:        requests.filter((r) => r.status === "completed").length,
  }), [requests]);

  const filterCounts = useMemo(() => {
    const counts = {} as Record<FilterKey, number>;
    counts.all = requests.length;
    FILTER_TABS.slice(1).forEach((t) => {
      counts[t.key] = requests.filter((r) => r.status === t.key).length;
    });
    return counts;
  }, [requests]);

  const filtered = useMemo(() => {
    let list = requests;
    if (activeFilter !== "all") {
      list = list.filter((r) => r.status === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.business_name.toLowerCase().includes(q) ||
          requestIdLabel(r.id).toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, activeFilter, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const someFilteredSelected = filtered.some((r) => selectedIds.has(r.id));

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleStatusChange = async (id: number, newStatus: RequestStatus) => {
    setActionId(id);
    try {
      await apiFetch(`/api/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchData();
      toast({ title: `${requestIdLabel(id)} updated`, description: `Status changed to ${STATUS_BADGE[newStatus].label}.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update status." });
    } finally {
      setActionId(null);
    }
  };

  const handleAccept   = (id: number) => setConfirmStatus({ id, status: "accepted",   label: "Accept",   description: "Accept this business delivery request?" });
  const handleReject   = (id: number) => setConfirmStatus({ id, status: "rejected",   label: "Reject",   description: "Reject this business delivery request? It can still be accepted later." });
  const handleComplete = (id: number) => setConfirmStatus({ id, status: "completed",  label: "Complete", description: "Mark this business delivery request as completed?" });
  const handleCancel   = (id: number) => setConfirmStatus({ id, status: "cancelled",  label: "Cancel",   description: "Cancel this business delivery request? It can still be accepted later." });
  const handleDelete   = (id: number) => setConfirmDeleteId(id);

  const executeDelete = async (id: number) => {
    setConfirmDeleteId(null);
    setActionId(id);
    try {
      await apiFetch(`/api/requests/${id}`, { method: "DELETE" });
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      toast({ title: "Request deleted", description: `${requestIdLabel(id)} has been removed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete request." });
    } finally {
      setActionId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map((id) => apiFetch(`/api/requests/${id}`, { method: "DELETE" })));
      const count = selectedIds.size;
      setRequests((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      clearSelection();
      toast({ title: `${count} request${count !== 1 ? "s" : ""} deleted`, description: "Selected requests have been removed." });
    } catch (err) {
      toast({ variant: "destructive", title: "Bulk delete failed", description: err instanceof Error ? err.message : "Failed to delete selected requests." });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: RequestStatus, eligible: RequestStatus[], label: string) => {
    const targets = filtered.filter((r) => selectedIds.has(r.id) && eligible.includes(r.status));
    if (!targets.length) {
      toast({ variant: "destructive", title: "No eligible requests", description: `None of the selected requests can be ${label.toLowerCase()}d.` });
      return;
    }
    setBulkProcessing(true);
    try {
      await Promise.all(targets.map((r) => apiFetch(`/api/requests/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) })));
      await fetchData();
      clearSelection();
      toast({ title: `${targets.length} request${targets.length !== 1 ? "s" : ""} ${label.toLowerCase()}d`, description: "Status updated successfully." });
    } catch (err) {
      toast({ variant: "destructive", title: `Bulk ${label.toLowerCase()} failed`, description: err instanceof Error ? err.message : "Failed to update requests." });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleCreateNewDelivery = async (payload: CreateDeliveryPayload) => {
    setSaving(true);
    try {
      await apiFetch("/api/deliveries", {
        method: "POST",
        body: JSON.stringify({ ...payload, status: "awaiting_approval" }),
      });
      setAddOpen(false);
      toast({ title: "Business delivery created", description: "The business delivery has been added." });
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (data: { business_id?: number; drivers_requested: number; start_date: string; end_date: string; notes: string; provider_notes: string }) => {
    setSaving(true);
    try {
      await apiFetch("/api/requests", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setAddOpen(false);
      await fetchData();
      toast({ title: "Business delivery created", description: "New business delivery request has been added." });
    } catch (err) {
      toast({ variant: "destructive", title: "Create failed", description: err instanceof Error ? err.message : "Failed to create request." });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRequest = (r: AllocationRequest, data: { drivers_requested: number; start_date: string; end_date: string; notes: string; provider_notes: string }) => {
    setEditRequest(null);
    setConfirmUpdate({ id: r.id, payload: data });
  };

  const executeUpdate = async () => {
    if (!confirmUpdate) return;
    const { id, payload } = confirmUpdate;
    setConfirmUpdate(null);
    setSaving(true);
    try {
      await apiFetch(`/api/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await fetchData();
      toast({ title: "Request updated", description: `${requestIdLabel(id)} has been updated.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update request." });
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    const rows = filtered.map((r) => ({
      "Request ID":        requestIdLabel(r.id),
      "Business":          r.business_name,
      "Drivers Requested": r.drivers_requested,
      "Allocated":         r.allocated_count,
      "Status":            STATUS_BADGE[r.status].label,
      "Start Date":        formatDate(r.start_date),
      "End Date":          formatDate(r.end_date),
      "Notes":             r.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.sheet_add_aoa(ws, [[`Total: ${filtered.length} request${filtered.length !== 1 ? "s" : ""}`]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Business Deliveries");
    XLSX.writeFile(wb, `business-deliveries-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    setExportOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    let y = 14;
    const orgName = provider?.provider_name ?? "Business Deliveries";
    doc.setFontSize(16); doc.setTextColor(22, 35, 24); doc.setFont("helvetica", "bold");
    doc.text(orgName, 14, y); y += 7;
    if (provider?.legal_name && provider.legal_name !== provider.provider_name) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(provider.legal_name, 14, y); y += 5;
    }
    const infoParts: string[] = [];
    if (provider?.contact_email) infoParts.push(provider.contact_email);
    if (provider?.contact_phone) infoParts.push(provider.contact_phone);
    if (provider?.city)          infoParts.push(provider.city);
    if (provider?.country)       infoParts.push(provider.country);
    if (infoParts.length) {
      doc.setFontSize(8); doc.setTextColor(120); doc.setFont("helvetica", "normal");
      doc.text(infoParts.join("  ·  "), 14, y); y += 5;
    }
    doc.setDrawColor(220); doc.line(14, y, 283, y); y += 5;
    doc.setFontSize(11); doc.setTextColor(22, 35, 24); doc.setFont("helvetica", "bold");
    doc.text("Business Deliveries", 14, y);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
    doc.text(`Exported ${format(new Date(), "d MMM yyyy")}`, 283, y, { align: "right" }); y += 5;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`${filtered.length} request${filtered.length !== 1 ? "s" : ""}`, 14, y); y += 5;
    autoTable(doc, {
      startY: y,
      head: [["ID", "Business", "Drivers", "Allocated", "Status", "Start Date", "End Date", "Notes"]],
      body: filtered.map((r) => [
        requestIdLabel(r.id),
        r.business_name,
        r.drivers_requested,
        r.allocated_count,
        STATUS_BADGE[r.status].label,
        formatDate(r.start_date),
        formatDate(r.end_date),
        r.notes ?? "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 35, 24] },
    });
    const orgSlug = (provider?.provider_name ?? "roundi").toLowerCase().replace(/\s+/g, "-");
    doc.save(`${orgSlug}-business-deliveries-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    setExportOpen(false);
  };

  const renderCard = (r: AllocationRequest) => {
    const badge = STATUS_BADGE[r.status];
    const busy = actionId === r.id;

    return (
      <div
        key={r.id}
        className="bg-white rounded-2xl shadow-sm flex flex-col"
        style={{ border: selectedIds.has(r.id) ? "1.5px solid #10B981" : "1px solid #f3f4f6" }}
      >
        <div className="relative px-5 pt-4 pb-3">
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button type="button" onClick={() => handleDelete(r.id)}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setEditRequest(r)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => toggleSelect(r.id)}
              className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                selectedIds.has(r.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
              }`}>
              {selectedIds.has(r.id) && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          <span className="text-xs font-semibold text-gray-400 tracking-wide pr-8 block">{requestIdLabel(r.id)}</span>
          <p className="text-base font-bold text-gray-900 leading-snug mt-0.5 pr-8 truncate">{r.business_name}</p>
          <div className="mt-2.5">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
              {badge.label}
            </span>
          </div>
        </div>

        <div className="border-t px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          {([
            ["DRIVERS", `${r.drivers_requested} requested${r.allocated_count > 0 ? ` · ${r.allocated_count} allocated` : ""}`],
            ["START DATE", formatDate(r.start_date)],
            ["END DATE",   formatDate(r.end_date)],
            ["NOTES",      r.notes ?? "—"],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
              <div className="text-sm font-medium text-gray-800 mt-0.5 truncate">{value}</div>
            </div>
          ))}
        </div>

        <div className="border-t px-5 py-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setViewRequest(r)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            <Eye className="h-3.5 w-3.5" />View
          </button>
          {r.status === "pending" && (<>
            <button type="button" disabled={busy} onClick={() => handleAccept(r.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />Accept
            </button>
            <button type="button" disabled={busy} onClick={() => handleReject(r.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" />Reject
            </button>
          </>)}
          {(r.status === "accepted" || r.status === "partially_allocated" || r.status === "fully_allocated") && (<>
            <button type="button" disabled={busy} onClick={() => handleComplete(r.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />Complete
            </button>
            <button type="button" disabled={busy} onClick={() => handleCancel(r.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" />Cancel
            </button>
          </>)}
          {(r.status === "rejected" || r.status === "cancelled") && (
            <button type="button" disabled={busy} onClick={() => handleAccept(r.id)}
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
      <div className="border-b bg-white px-4 sm:px-5 pt-4 pb-0">
        <p className="text-xs text-gray-400 mb-4">
          <Link href="/dashboard/analytics" className="hover:text-gray-600 transition-colors">
            Dashboard
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600">Business Deliveries</span>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Deliveries</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage and track business allocation requests.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton onClick={fetchData} loading={loading} />

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <button onClick={exportExcel} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5">
                      <span className="text-base">📊</span> Excel (.xlsx)
                    </button>
                    <button onClick={exportPDF} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5 border-t border-gray-100">
                      <span className="text-base">📄</span> PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!providerId}
              onClick={() => {
                if (!providerId) return;
                const link = `${window.location.origin}/client-order?p=${providerId}`;
                navigator.clipboard.writeText(link).then(() => {
                  toast({ title: "Link copied!", description: "Share this link with your clients so they can place delivery orders." });
                }).catch(() => {
                  toast({ variant: "destructive", title: "Copy failed", description: link });
                });
              }}
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
              Add Business Delivery
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-6 space-y-6 flex-1">
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
            <StatCard label="Total"          value={stats.total} />
            <StatCard label="Pending"        value={stats.pending} />
            <StatCard label="Accepted"       value={stats.accepted} />
            <StatCard label="In Progress"    value={stats.inProgress} />
            <StatCard label="Fully Allocated" value={stats.fullyAllocated} />
            <StatCard label="Rejected"       value={stats.rejected} />
            <StatCard label="Completed"      value={stats.completed} />
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b space-y-2.5">
            {/* Row 1: Search + View toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by business, request ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 sm:w-80 rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`} title="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`} title="Table view">
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Row 2: Select-all + Filter chips */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={toggleSelectAll}
                className={`flex shrink-0 items-center justify-center h-4 w-4 rounded border transition-colors ${
                  allFilteredSelected ? "border-emerald-500 bg-emerald-500"
                    : someFilteredSelected ? "border-emerald-400 bg-white"
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
                      <span className="ml-1 text-xs opacity-60">({filterCounts[tab.key]})</span>
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
                <button type="button" disabled={bulkProcessing}
                  onClick={() => setConfirmBulkAction({ type: "status", status: "accepted", label: "Accept" })}
                  className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors">
                  Accept
                </button>
                <button type="button" disabled={bulkProcessing}
                  onClick={() => setConfirmBulkAction({ type: "status", status: "rejected", label: "Reject" })}
                  className="font-medium text-rose-500 hover:text-rose-600 disabled:opacity-50 transition-colors">
                  Reject
                </button>
                <button type="button" disabled={bulkProcessing}
                  onClick={() => setConfirmBulkAction({ type: "status", status: "completed", label: "Complete" })}
                  className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors">
                  Complete
                </button>
                <button type="button" disabled={bulkProcessing}
                  onClick={() => setConfirmBulkAction({ type: "status", status: "cancelled", label: "Cancel" })}
                  className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors">
                  Cancel
                </button>
                <div className="h-4 w-px bg-gray-200" />
                <button type="button" disabled={bulkProcessing}
                  onClick={() => setConfirmBulkAction({ type: "delete" })}
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

          {!loading && !error && requests.length > 0 && filtered.length === 0 && (
            <p className="px-5 pb-8 pt-6 text-sm text-gray-500 text-center">
              No requests match your filters.
            </p>
          )}

          {!loading && !error && filtered.length > 0 && viewMode === "list" && (
            <div className="border-t border-gray-100">
              <RequestsTable
                rows={filtered}
                actionId={actionId}
                selectedIds={selectedIds}
                onView={setViewRequest}
                onEdit={setEditRequest}
                onDelete={handleDelete}
                onToggleSelect={toggleSelect}
                onAccept={handleAccept}
                onReject={handleReject}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading business deliveries…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm font-medium text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData(); }}>
              Try again
            </Button>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-2xl border border-dashed border-gray-200 bg-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Package className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">No business deliveries yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Business allocation requests from your partners will appear here.
              </p>
            </div>
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
              Add Business Delivery
            </button>
          </div>
        ) : viewMode === "grid" && filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-8">
            {filtered.map((r) => renderCard(r))}
          </div>
        ) : null}
      </div>

      <ViewRequestModal
        request={viewRequest}
        onClose={() => setViewRequest(null)}
        onEdit={(r) => { setViewRequest(null); setEditRequest(r); }}
      />

      <NewBusinessDeliveryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreateNewDelivery}
        saving={saving}
      />

      <RequestFormModal
        open={editRequest !== null}
        onClose={() => setEditRequest(null)}
        onSubmit={(data) => editRequest && handleUpdateRequest(editRequest, data)}
        saving={saving}
        businesses={businesses}
        initialData={editRequest}
      />

      {/* Delete confirm modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-red-600">
                Do you want to delete {requestIdLabel(confirmDeleteId)}?
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button type="button" onClick={() => executeDelete(confirmDeleteId)}
                disabled={actionId === confirmDeleteId}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50">
                {actionId === confirmDeleteId ? "Deleting…" : "Delete"}
              </button>
              <button type="button" onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
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
                Save changes to {requestIdLabel(confirmUpdate.id)}?
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button type="button" onClick={executeUpdate} disabled={saving}
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
                className="flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" onClick={() => setConfirmUpdate(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
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
                  ? `Delete ${selectedIds.size} request${selectedIds.size !== 1 ? "s" : ""}?`
                  : `${confirmBulkAction.label} ${selectedIds.size} request${selectedIds.size !== 1 ? "s" : ""}?`}
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button type="button" disabled={bulkProcessing}
                onClick={() => {
                  const action = confirmBulkAction;
                  setConfirmBulkAction(null);
                  if (action.type === "delete") {
                    handleBulkDelete();
                  } else {
                    const eligibility: Record<string, RequestStatus[]> = {
                      accepted: BULK_ACCEPT_ELIGIBLE,
                      rejected: BULK_REJECT_ELIGIBLE,
                      completed: BULK_COMPLETE_ELIGIBLE,
                      cancelled: BULK_CANCEL_ELIGIBLE,
                    };
                    handleBulkStatusChange(action.status, eligibility[action.status] ?? [], action.label);
                  }
                }}
                className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90 ${
                  confirmBulkAction.type === "delete" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                }`}
                style={confirmBulkAction.type !== "delete" ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
              >
                {bulkProcessing ? "Processing…" : confirmBulkAction.type === "delete" ? "Delete" : confirmBulkAction.label}
              </button>
              <button type="button" onClick={() => setConfirmBulkAction(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
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
                {confirmStatus.description}
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button type="button" disabled={actionId === confirmStatus.id}
                onClick={() => {
                  const { id, status } = confirmStatus;
                  setConfirmStatus(null);
                  handleStatusChange(id, status);
                }}
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
                className="flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90">
                {actionId === confirmStatus.id ? "Updating…" : confirmStatus.label}
              </button>
              <button type="button" onClick={() => setConfirmStatus(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
