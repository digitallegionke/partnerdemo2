"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, MapPin, X, Eye, Upload, Download, ChevronDown, LayoutGrid, List, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RouteName = Database["public"]["Tables"]["partner_route_names"]["Row"];
type Provider  = Database["public"]["Tables"]["partner_providers"]["Row"];

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

export default function RouteNamesPage() {
  const [routeNames, setRouteNames]     = useState<RouteName[]>([]);
  const [provider, setProvider]         = useState<Provider | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingItem, setEditingItem]   = useState<RouteName | null>(null);
  const [viewingItem, setViewingItem]   = useState<RouteName | null>(null);
  const [saving, setSaving]             = useState(false);
  const [togglingId, setTogglingId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const { toast } = useToast();
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [deletingId, setDeletingId]       = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RouteName | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<{ type: "delete" | "activate" | "deactivate"; count: number } | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ name: string; notes: string; is_active: boolean } | null>(null);
  const [viewMode, setViewMode]           = useState<"grid" | "list">("grid");
  const [exportOpen, setExportOpen]       = useState(false);
  const [importing, setImporting]         = useState(false);
  const [importGuideOpen, setImportGuideOpen]   = useState(false);
  const [importError, setImportError]           = useState<{ title: string; rows: string[] } | null>(null);
  const [importProgress, setImportProgress]     = useState<{ current: number; total: number } | null>(null);
  const importRef                               = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("partner_provider_users")
        .select("provider_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership) return;
      const { data: prov } = await supabase
        .from("partner_providers")
        .select("*")
        .eq("id", (membership as { provider_id: number }).provider_id)
        .single();
      if (prov) setProvider(prov as Provider);
    })();
  }, []);

  const fetchRouteNames = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/route-names");
      setRouteNames(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load route names");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRouteNames(); }, [fetchRouteNames]);

  const handleAdd = () => { setEditingItem(null); setEditModalOpen(true); };

  const handleEdit = (item: RouteName) => { setEditingItem(item); setEditModalOpen(true); };

  const handleView = (item: RouteName) => { setViewingItem(item); setViewModalOpen(true); };

  const handleDelete = (item: RouteName) => {
    setConfirmDelete(item);
  };

  const executeDelete = async (item: RouteName) => {
    setConfirmDelete(null);
    setDeletingId(item.id);
    try {
      await apiFetch(`/api/route-names/${item.id}`, { method: "DELETE" });
      setRouteNames((prev) => prev.filter((r) => r.id !== item.id));
      if (viewingItem?.id === item.id) setViewModalOpen(false);
      toast({ title: "Route name deleted", description: `"${item.name}" has been removed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete route name." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (item: RouteName) => {
    setTogglingId(item.id);
    try {
      const updated = await apiFetch(`/api/route-names/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      setRouteNames((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (viewingItem?.id === item.id) setViewingItem(updated);
    } catch {
      toast({ variant: "destructive", title: "Update failed", description: "Failed to update status. Please try again." });
    } finally {
      setTogglingId(null);
    }
  };

  const handleSave = async (name: string, notes: string, is_active: boolean) => {
    if (editingItem) {
      setPendingUpdate({ name, notes, is_active });
      setConfirmUpdate(true);
      setEditModalOpen(false);
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch("/api/route-names", {
        method: "POST",
        body: JSON.stringify({ name, notes, is_active }),
      });
      setRouteNames((prev) => [created, ...prev]);
      toast({ title: "Route name added", description: `"${name}" has been added.` });
      setEditModalOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : "Failed to save route name." });
    } finally {
      setSaving(false);
    }
  };

  const executeUpdate = async () => {
    if (!editingItem || !pendingUpdate) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/route-names/${editingItem.id}`, {
        method: "PATCH",
        body: JSON.stringify(pendingUpdate),
      });
      setRouteNames((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (viewingItem?.id === editingItem.id) setViewingItem(updated);
      toast({ title: "Route name updated", description: `"${pendingUpdate.name}" has been updated.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update route name." });
    } finally {
      setSaving(false);
      setConfirmUpdate(false);
      setPendingUpdate(null);
    }
  };

  const exportExcel = () => {
    const rows = filtered.map((r) => ({
      "Route Name":    r.name,
      "Serving Areas": r.notes ?? "",
      "Status":        r.is_active ? "Active" : "Inactive",
      "Created At":    format(new Date(r.created_at), "d MMM yyyy"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Route Names");
    XLSX.writeFile(wb, "route-names.xlsx");
    setExportOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 14;

    // Org name
    const orgName = provider?.provider_name ?? "Route Names Report";
    doc.setFontSize(16);
    doc.setTextColor(22, 35, 24);
    doc.setFont("helvetica", "bold");
    doc.text(orgName, 14, y);
    y += 7;

    // Legal name (if different)
    if (provider?.legal_name && provider.legal_name !== provider.provider_name) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(provider.legal_name, 14, y);
      y += 5;
    }

    // Basic info line
    const infoParts: string[] = [];
    if (provider?.contact_email) infoParts.push(provider.contact_email);
    if (provider?.contact_phone) infoParts.push(provider.contact_phone);
    if (provider?.city)          infoParts.push(provider.city);
    if (provider?.country)       infoParts.push(provider.country);
    if (infoParts.length) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.setFont("helvetica", "normal");
      doc.text(infoParts.join("  ·  "), 14, y);
      y += 5;
    }

    // Divider
    doc.setDrawColor(220);
    doc.line(14, y, 196, y);
    y += 5;

    // Section title + export date
    const sectionTitle =
      statusFilter === "active"   ? "Active Route Names" :
      statusFilter === "inactive" ? "Inactive Route Names" :
                                    "All Route Names";
    doc.setFontSize(11);
    doc.setTextColor(22, 35, 24);
    doc.setFont("helvetica", "bold");
    doc.text(sectionTitle, 14, y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(`Exported ${format(new Date(), "d MMM yyyy")}`, 196, y, { align: "right" });
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Route Name", "Serving Areas", "Status", "Created At"]],
      body: filtered.map((r) => [
        r.name,
        r.notes ?? "—",
        r.is_active ? "Active" : "Inactive",
        format(new Date(r.created_at), "d MMM yyyy"),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 35, 24] },
    });

    const slug = (provider?.provider_name ?? "route-names")
      .toLowerCase().replace(/\s+/g, "-");
    doc.save(`${slug}-route-names.pdf`);
    setExportOpen(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
      const parsed = rows.map((r, i) => {
        const name   = (r["Route Name"] ?? r["route_name"] ?? r["name"] ?? "").toString().trim();
        const status = (r["Status"] ?? r["status"] ?? "").toString().toLowerCase().trim();
        const validStatus = status === "active" ? true : status === "inactive" ? false : null;
        return {
          row:       i + 2,
          name,
          notes:     (r["Serving Areas"] ?? r["serving_areas"] ?? r["notes"] ?? "").toString().trim(),
          is_active: validStatus,
          missingName:   !name,
          missingStatus: validStatus === null,
        };
      });

      const invalidRows = parsed.filter((r) => r.missingName || r.missingStatus);
      if (invalidRows.length) {
        const lines = invalidRows.map((r) => {
          const missing = [
            r.missingName   && "Route Name",
            r.missingStatus && "Status",
          ].filter(Boolean).join(", ");
          return `Row ${r.row}: missing ${missing}`;
        });
        setImportError({
          title: `Upload failed — ${invalidRows.length} row${invalidRows.length > 1 ? "s are" : " is"} missing required fields`,
          rows: lines,
        });
        return;
      }

      const toCreate = parsed as (typeof parsed[0] & { is_active: boolean })[];
      if (!toCreate.length) {
        toast({ variant: "destructive", title: "No data found", description: "Make sure the sheet has data and a 'Route Name' column." });
        return;
      }
      let created = 0;
      setImportProgress({ current: 0, total: toCreate.length });
      for (let i = 0; i < toCreate.length; i++) {
        try {
          const result = await apiFetch("/api/route-names", {
            method: "POST",
            body: JSON.stringify({ name: toCreate[i].name, notes: toCreate[i].notes, is_active: toCreate[i].is_active }),
          });
          setRouteNames((prev) => [result, ...prev]);
          created++;
        } catch { /* skip duplicates / errors silently */ }
        setImportProgress({ current: i + 1, total: toCreate.length });
      }
      setImportProgress(null);
      toast({
        title: "Import successful",
        description: `${created} of ${toCreate.length} route name${toCreate.length !== 1 ? "s" : ""} imported successfully.`,
      });
    } catch {
      setImportProgress(null);
      toast({ variant: "destructive", title: "Import failed", description: "Failed to read the file. Please use a valid Excel file." });
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    let result = routeNames;
    if (statusFilter === "active")   result = result.filter((r) => r.is_active);
    if (statusFilter === "inactive") result = result.filter((r) => !r.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    return result;
  }, [routeNames, search, statusFilter]);

  const stats = useMemo(() => ({
    total:    routeNames.length,
    active:   routeNames.filter((r) => r.is_active).length,
    inactive: routeNames.filter((r) => !r.is_active).length,
  }), [routeNames]);

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

  const handleBulkDelete = () => {
    if (!selectedIds.size) return;
    setConfirmBulkAction({ type: "delete", count: selectedIds.size });
  };

  const handleBulkSetActive = (is_active: boolean) => {
    if (!selectedIds.size) return;
    setConfirmBulkAction({ type: is_active ? "activate" : "deactivate", count: selectedIds.size });
  };

  const executeBulkAction = async () => {
    if (!confirmBulkAction) return;
    setBulkProcessing(true);
    setConfirmBulkAction(null);
    if (confirmBulkAction.type === "delete") {
      try {
        await Promise.all([...selectedIds].map((id) => apiFetch(`/api/route-names/${id}`, { method: "DELETE" })));
        const count = selectedIds.size;
        setRouteNames((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        clearSelection();
        toast({ title: `${count} route name${count !== 1 ? "s" : ""} deleted`, description: "Selected route names have been removed." });
      } catch (err) {
        toast({ variant: "destructive", title: "Bulk delete failed", description: err instanceof Error ? err.message : "Failed to delete selected route names." });
      }
    } else {
      const is_active = confirmBulkAction.type === "activate";
      try {
        const results = await Promise.all(
          [...selectedIds].map((id) => apiFetch(`/api/route-names/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) }))
        );
        setRouteNames((prev) => prev.map((r) => {
          const updated = results.find((u) => u.id === r.id);
          return updated ?? r;
        }));
        const count = selectedIds.size;
        clearSelection();
        toast({ title: `${count} route name${count !== 1 ? "s" : ""} ${is_active ? "activated" : "deactivated"}`, description: `Selected route names have been ${is_active ? "set to active" : "set to inactive"}.` });
      } catch (err) {
        toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update selected route names." });
      }
    }
    setBulkProcessing(false);
  };

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-4 sm:px-8 py-4 sm:py-5">
          <div>
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Link href="/dashboard/analytics" className="hover:text-gray-700 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">Route Names</span>
            </nav>
            <h2 className="text-xl font-semibold text-gray-900">Route Names</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage the names used for your delivery routes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import */}
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => setImportGuideOpen(true)}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {importing ? "Importing…" : "Import"}
            </button>

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
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-40 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <button
                      onClick={exportExcel}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                    >
                      <span className="text-base">📊</span> Excel (.xlsx)
                    </button>
                    <button
                      onClick={exportPDF}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5 border-t border-gray-100"
                    >
                      <span className="text-base">📄</span> PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* New Route Name */}
            <button
              onClick={handleAdd}
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
              New Route Name
            </button>
          </div>
        </div>

        {/* Stats cards */}
        {!loading && !error && routeNames.length > 0 && (
          <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-2 grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
            {[
              { label: "Total Routes",    value: stats.total    },
              { label: "Active Routes",   value: stats.active   },
              { label: "Inactive Routes", value: stats.inactive },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-3 sm:px-5 py-3 sm:py-4">
                <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate">{s.label}</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filters + View toggle — all one row */}
        {!loading && !error && (
          <div className="px-4 sm:px-8 pt-5 pb-3 flex flex-wrap items-center gap-2.5">
            {/* Select-all checkbox */}
            <button
              onClick={toggleSelectAll}
              className={`flex items-center justify-center h-5 w-5 rounded border transition-colors shrink-0 ${
                allFilteredSelected
                  ? "border-emerald-500 bg-emerald-500"
                  : someFilteredSelected
                  ? "border-emerald-400 bg-white"
                  : "border-gray-300 bg-white hover:border-emerald-400"
              }`}
              title={allFilteredSelected ? "Deselect all" : "Select all"}
            >
              {allFilteredSelected && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {someFilteredSelected && !allFilteredSelected && (
                <div className="h-0.5 w-2.5 bg-emerald-500 rounded-full" />
              )}
            </button>
            {/* Search */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search route names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {(["all", "active", "inactive"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors"
                  style={
                    statusFilter === f
                      ? { backgroundColor: "#CDF782", color: "#162318", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                      : { color: "#6b7280" }
                  }
                >
                  {f}
                </button>
              ))}
            </div>

            {/* View toggle — pushed to the far right */}
            <div className="ml-auto flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
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
        )}

        {/* Bulk action bar */}
        {someFilteredSelected && (
          <div className="px-4 sm:px-8 pb-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm text-sm">
              <span className="font-semibold text-gray-700">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-gray-200" />
              <button
                onClick={() => handleBulkSetActive(true)}
                disabled={bulkProcessing}
                className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors"
              >
                {bulkProcessing ? "Processing…" : "Activate"}
              </button>
              <button
                onClick={() => handleBulkSetActive(false)}
                disabled={bulkProcessing}
                className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
              >
                Deactivate
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <button
                onClick={handleBulkDelete}
                disabled={bulkProcessing}
                className="flex items-center gap-1.5 text-red-500 hover:text-red-600 font-medium disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading route names...</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-sm font-medium text-red-600">Failed to load route names</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRouteNames}>Try again</Button>
          </div>

        ) : routeNames.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                <MapPin className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No route names yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add names for your delivery routes to keep them organised.
                </p>
              </div>
              <Button onClick={handleAdd} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="h-4 w-4" />
                Add your first route name
              </Button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No route names found</p>
            <p className="text-xs text-muted-foreground">Try a different search term.</p>
          </div>

        ) : viewMode === "grid" ? (
          /* ── Card / Grid view ── */
          <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl hover:shadow-md transition-shadow flex flex-col"
                style={{ border: selectedIds.has(item.id) ? "1.5px solid #10B981" : "1px solid #E5E7EB" }}
              >
                {/* Card header */}
                <div className="relative px-5 pt-5 pb-0">
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete route name"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                        selectedIds.has(item.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                      }`}
                      title={selectedIds.has(item.id) ? "Deselect" : "Select"}
                    >
                      {selectedIds.has(item.id) && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 pr-16">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight">{item.name}</p>
                  </div>
                  {/* Status badge on own row */}
                  <div className="mt-2.5 pb-4">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      disabled={togglingId === item.id}
                      className="flex items-center gap-1.5"
                      title={item.is_active ? "Click to deactivate" : "Click to activate"}
                    >
                      <span className={["relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                        item.is_active ? "bg-emerald-500" : "bg-gray-200",
                        togglingId === item.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                      ].join(" ")}>
                        <span className={["pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                          item.is_active ? "translate-x-3" : "translate-x-0",
                        ].join(" ")} />
                      </span>
                      <span className={`text-xs font-medium ${item.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Serving areas */}
                <div className="border-t px-5 py-3 flex-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Serving Areas</p>
                  {item.notes
                    ? <p className="text-sm text-gray-600 italic line-clamp-2">{item.notes}</p>
                    : <p className="text-sm text-gray-300 italic">—</p>}
                  <p className="mt-2 text-xs text-gray-400">{format(new Date(item.created_at), "d MMM yyyy")}</p>
                </div>

                {/* Actions */}
                <div className="border-t grid grid-cols-2 gap-3 p-3 mt-auto">
                  <button onClick={() => handleView(item)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button onClick={() => handleEdit(item)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

        ) : (
          /* ── Table view ── */
          <div className="px-4 sm:px-8 pb-8 overflow-x-auto">
            <table className="w-full border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pt-1 w-10" />
                  {["Route Name", "Serving Areas", "Status", "Created At", "Actions"].map((h, i) => (
                    <th key={h} className={`pb-3 pt-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.has(item.id) ? "bg-emerald-50/50" : ""}`}>
                    <td className="py-3.5 pr-2 w-10">
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                          selectedIds.has(item.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                        }`}
                      >
                        {selectedIds.has(item.id) && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>
                    {/* Route name */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100">
                          <MapPin className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    {/* Serving Areas */}
                    <td className="py-3.5 pr-4 text-sm text-gray-500 max-w-[260px]">
                      {item.notes
                        ? <span className="italic truncate block">{item.notes}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Status toggle */}
                    <td className="py-3.5 pr-4">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        disabled={togglingId === item.id}
                        className="flex items-center gap-2"
                        title={item.is_active ? "Click to deactivate" : "Click to activate"}
                      >
                        <span className={["relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                          item.is_active ? "bg-emerald-500" : "bg-gray-200",
                          togglingId === item.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                        ].join(" ")}>
                          <span className={["pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
                            item.is_active ? "translate-x-4" : "translate-x-0",
                          ].join(" ")} />
                        </span>
                        <span className={`text-xs font-medium ${item.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    {/* Date */}
                    <td className="py-3.5 pr-4 text-sm text-gray-500 whitespace-nowrap">
                      {format(new Date(item.created_at), "d MMM yyyy")}
                    </td>
                    {/* Actions — icons only */}
                    <td className="py-3.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => handleView(item)} title="View"
                          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleEdit(item)} title="Edit"
                          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(item)} title="Delete"
                          className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-gray-400">
              {filtered.length} route {filtered.length === 1 ? "name" : "names"}
            </p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <RouteNameModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
        item={editingItem}
        saving={saving}
      />

      {/* View detail modal */}
      {viewingItem && (
        <RouteNameViewModal
          isOpen={viewModalOpen}
          item={viewingItem}
          onClose={() => setViewModalOpen(false)}
          onEdit={() => { setViewModalOpen(false); handleEdit(viewingItem); }}
          onToggleStatus={() => handleToggleStatus(viewingItem)}
          toggling={togglingId === viewingItem.id}
        />
      )}

      {/* Import progress modal */}
      {importProgress && (
        <ImportProgressModal current={importProgress.current} total={importProgress.total} />
      )}

      {/* Import error modal */}
      {importError && (
        <ImportErrorModal
          title={importError.title}
          rows={importError.rows}
          onClose={() => setImportError(null)}
        />
      )}

      {/* Import guide modal */}
      <ImportGuideModal
        isOpen={importGuideOpen}
        onClose={() => setImportGuideOpen(false)}
        onProceed={() => { setImportGuideOpen(false); importRef.current?.click(); }}
      />

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className="text-sm font-semibold text-red-600">
                Do you want to delete &quot;{confirmDelete.name}&quot;?
              </h3>
              <button onClick={() => setConfirmDelete(null)} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDelete(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm update modal */}
      {confirmUpdate && pendingUpdate && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setConfirmUpdate(false); setPendingUpdate(null); }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Do you want to update &quot;{editingItem.name}&quot;?
              </h3>
              <button onClick={() => { setConfirmUpdate(false); setPendingUpdate(null); }} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => { setConfirmUpdate(false); setPendingUpdate(null); }}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeUpdate}
                disabled={saving}
                className="flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm bulk action modal */}
      {confirmBulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmBulkAction(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className={`text-sm font-semibold ${confirmBulkAction.type === "delete" ? "text-red-600" : "text-gray-900"}`}>
                {confirmBulkAction.type === "delete"
                  ? `Do you want to delete ${confirmBulkAction.count} route name${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : confirmBulkAction.type === "activate"
                  ? `Do you want to activate ${confirmBulkAction.count} route name${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : `Do you want to deactivate ${confirmBulkAction.count} route name${confirmBulkAction.count !== 1 ? "s" : ""}?`}
              </h3>
              <button onClick={() => setConfirmBulkAction(null)} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setConfirmBulkAction(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                disabled={bulkProcessing}
                className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 ${
                  confirmBulkAction.type === "delete" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                }`}
                style={confirmBulkAction.type !== "delete" ? { backgroundColor: "#CDF782", color: "#162318" } : undefined}
              >
                {bulkProcessing ? "Processing…" : confirmBulkAction.type === "delete" ? "Delete" : confirmBulkAction.type === "activate" ? "Activate" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Edit Modal ─── */

function RouteNameModal({
  isOpen,
  onClose,
  onSave,
  item,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, notes: string, is_active: boolean) => void;
  item: RouteName | null;
  saving: boolean;
}) {
  const [name, setName]         = useState("");
  const [notes, setNotes]       = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setName(item?.name ?? "");
      setNotes(item?.notes ?? "");
      setIsActive(item?.is_active ?? true);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), notes.trim(), isActive);
  };

  const isEdit = item !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {isEdit ? "Edit Route" : "New Route Name"}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEdit ? "Update the details for this route" : "Add a name to the route registry"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 space-y-4">

            {/* Route Name */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Route Name
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Westlands Express"
                  autoFocus
                  className="w-full rounded-lg border border-emerald-500 pl-9 pr-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Serving Areas */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Serving Areas
                <span className="ml-1 text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Serves Westlands, Chiromo and ABC..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                <p className="text-xs text-gray-400 mt-0.5">{isActive ? "Active — visible on routes" : "Inactive — hidden from routes"}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isActive ? "bg-emerald-500" : "bg-gray-200"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${isActive ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="px-6 pb-6 pt-5 space-y-2">
            <button
              type="submit"
              disabled={!name.trim() || saving}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "12px 20px", fontSize: 14, fontWeight: 600,
                color: "#162318",
                backgroundColor: (!name.trim() || saving) ? "#e5f7a0" : "#CDF782",
                border: "none", borderRadius: 12, cursor: (!name.trim() || saving) ? "not-allowed" : "pointer",
                opacity: (!name.trim() || saving) ? 0.5 : 1, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (name.trim() && !saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f"; }}
              onMouseLeave={(e) => { if (name.trim() && !saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782"; }}
            >
              {saving ? (
                "Saving..."
              ) : isEdit ? (
                "Save Changes"
              ) : (
                <><Plus className="h-4 w-4" />Add Route Name</>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-3 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── View Detail Modal ─── */

function RouteNameViewModal({
  isOpen,
  item,
  onClose,
  onEdit,
  onToggleStatus,
  toggling,
}: {
  isOpen: boolean;
  item: RouteName;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  toggling: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Route details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                item.is_active
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-100 text-gray-500 border border-gray-200"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${item.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                {item.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <button
              onClick={onToggleStatus}
              disabled={toggling}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                item.is_active
                  ? "border-orange-200 text-orange-600 hover:bg-orange-50"
                  : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {toggling ? "Updating..." : item.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>

          {/* Serving Areas */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Serving Areas</p>
            {item.notes
              ? <p className="text-sm text-gray-700 leading-relaxed">{item.notes}</p>
              : <p className="text-sm text-gray-300 italic">No serving areas specified</p>
            }
          </div>

          {/* Added date */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Date Added</p>
            <p className="text-sm text-gray-700">{format(new Date(item.created_at), "d MMM yyyy")}</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 pt-1 flex gap-2">
          <button
            onClick={onEdit}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600,
              color: "#162318", backgroundColor: "#CDF782",
              border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            Edit Route
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-[10px] border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Import Progress Modal ─── */

function ImportProgressModal({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden px-8 py-8">

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
            <Upload className="h-6 w-6 text-emerald-600" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-6">
          <h3 className="text-sm font-semibold text-gray-900">Importing route names…</h3>
          <p className="mt-1 text-xs text-gray-400">
            {current} of {total} row{total !== 1 ? "s" : ""} processed
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full rounded-full bg-gray-100 h-2.5 overflow-hidden">
          <div
            className="h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: "#CDF782" }}
          />
        </div>
        <p className="mt-2 text-right text-xs font-semibold text-gray-500">{pct}%</p>
      </div>
    </div>
  );
}

/* ─── Import Error Modal ─── */

function ImportErrorModal({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: string[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-red-200">
              <X className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-700">Upload Failed</h3>
              <p className="text-xs text-red-500 mt-0.5">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-red-400 hover:text-red-600 transition-colors rounded-md p-1 hover:bg-red-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Row errors */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-gray-500">The following rows have missing required fields:</p>
          <div className="rounded-xl border border-red-100 bg-red-50 divide-y divide-red-100 max-h-52 overflow-y-auto">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-xs text-red-700">{row}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Please update your file with the missing values and try uploading again.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-1">
          <button
            onClick={onClose}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600,
              color: "#162318", backgroundColor: "#CDF782",
              border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            Got it, I'll fix the file
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Import Guide Modal ─── */

const IMPORT_COLUMNS = [
  { name: "Route Name",    required: true,  example: "Mombasa Road",                   note: "The name of the route"                        },
  { name: "Serving Areas", required: false, example: "Serves CBD, Westlands, Chiromo", note: "Areas covered by this route"                  },
  { name: "Status",        required: true,  example: "Active / Inactive",              note: "Must be Active or Inactive"                    },
];

function ImportGuideModal({
  isOpen,
  onClose,
  onProceed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
              <Upload className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Import Route Names</h3>
              <p className="text-xs text-gray-400 mt-0.5">Prepare your Excel file using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* File type note */}
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <span className="text-base">📋</span>
            <p className="text-xs text-blue-700">
              Accepted file types: <strong>.xlsx</strong> or <strong>.xls</strong>. The first sheet will be used.
            </p>
          </div>

          {/* Columns table */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Required columns</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Column Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {IMPORT_COLUMNS.map((col) => (
                    <tr key={col.name}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                          {col.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {col.required
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Required</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"><span className="h-1.5 w-1.5 rounded-full bg-gray-300 inline-block" />Optional</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 italic">{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <span className="text-base mt-0.5">💡</span>
            <p className="text-xs text-amber-700">
              Column names must match exactly as shown above. Rows with an empty <strong>Route Name</strong> column will be skipped.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-1 flex gap-2">
          <button
            onClick={onProceed}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600,
              color: "#162318", backgroundColor: "#CDF782",
              border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            <Upload className="h-4 w-4" />
            Browse File
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-[10px] border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
