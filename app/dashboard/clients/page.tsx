"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Plus, Search, LayoutGrid, List,
  Pencil, Trash2, Eye, X, Upload, Download, ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import ClientModal from "@/components/ClientModal";
import ClientViewModal from "@/components/ClientViewModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type Client   = Database["public"]["Tables"]["partner_clients"]["Row"];
type Provider = Database["public"]["Tables"]["partner_providers"]["Row"];
type FilterTab = "all" | "active" | "inactive";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "active",   label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const AVATAR_COLORS = [
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-blue-100",    text: "text-blue-700"    },
  { bg: "bg-violet-100",  text: "text-violet-700"  },
  { bg: "bg-rose-100",    text: "text-rose-700"    },
  { bg: "bg-amber-100",   text: "text-amber-700"   },
  { bg: "bg-cyan-100",    text: "text-cyan-700"    },
  { bg: "bg-indigo-100",  text: "text-indigo-700"  },
  { bg: "bg-teal-100",    text: "text-teal-700"    },
];

function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function clientCode(id: number) { return `cl-${String(id).padStart(3, "0")}`; }

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

type ClientFormData = {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  area: string;
  note: string;
  status: "active" | "inactive";
};

export default function ClientsPage() {
  const [clients, setClients]               = useState<Client[]>([]);
  const [provider, setProvider]             = useState<Provider | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [activeTab, setActiveTab]           = useState<FilterTab>("all");
  const [viewMode, setViewMode]             = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen]           = useState(false);
  const [viewOpen, setViewOpen]             = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saving, setSaving]                 = useState(false);

  const [selectedIds, setSelectedIds]             = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing]       = useState(false);
  const [confirmDelete, setConfirmDelete]         = useState<Client | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<
    { type: "delete" } | { type: "activate" } | { type: "deactivate" } | null
  >(null);
  const [confirmUpdate, setConfirmUpdate] = useState<{ client: Client; formData: ClientFormData } | null>(null);

  // import / export state
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting]             = useState(false);
  const [importGuideOpen, setImportGuideOpen] = useState(false);
  const [importError, setImportError]         = useState<{ title: string; rows: string[] } | null>(null);
  const [importProgress, setImportProgress]   = useState<{ current: number; total: number } | null>(null);
  const [exportOpen, setExportOpen]           = useState(false);

  const { toast } = useToast();

  // ── provider fetch (for PDF header) ───────────────────────────────────────
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

  // ── data fetch ────────────────────────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/clients");
      setClients(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // ── derived ───────────────────────────────────────────────────────────────
  const exportTitle = activeTab === "active" ? "Active Clients" : activeTab === "inactive" ? "Inactive Clients" : "All Clients";

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: clients.length, active: 0, inactive: 0 };
    clients.forEach((c) => {
      if (c.status === "active")   counts.active++;
      if (c.status === "inactive") counts.inactive++;
    });
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? clients : clients.filter((c) => c.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.contact_name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [clients, activeTab, search]);

  const allFilteredSelected  = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someFilteredSelected = filtered.some((c) => selectedIds.has(c.id));

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAdd  = () => { setSelectedClient(null); setModalOpen(true); };
  const handleView = (c: Client) => { setSelectedClient(c); setViewOpen(true); };
  const handleEdit = (c: Client) => { setSelectedClient(c); setModalOpen(true); };
  const handleDelete = (c: Client) => setConfirmDelete(c);

  const executeDelete = async (c: Client) => {
    setConfirmDelete(null);
    try {
      await apiFetch(`/api/clients/${c.id}`, { method: "DELETE" });
      setClients((prev) => prev.filter((x) => x.id !== c.id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(c.id); return s; });
      toast({ title: "Client deleted", description: `${c.company_name} has been removed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete client." });
    }
  };

  const handleSave = async (formData: ClientFormData) => {
    if (selectedClient) {
      setModalOpen(false);
      setConfirmUpdate({ client: selectedClient, formData });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_name: formData.company_name,
        contact_name: formData.contact_name,
        phone: formData.phone,
        email: formData.email || null,
        area: formData.area || null,
        note: formData.note || null,
        status: formData.status,
      };
      const created = await apiFetch("/api/clients", { method: "POST", body: JSON.stringify(payload) });
      setClients((prev) => [created, ...prev]);
      setModalOpen(false);
      toast({ title: "Client added", description: `${payload.company_name} has been added.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : "Failed to save client." });
    } finally {
      setSaving(false);
    }
  };

  const executeUpdate = async () => {
    if (!confirmUpdate) return;
    const { client, formData } = confirmUpdate;
    setConfirmUpdate(null);
    setSaving(true);
    try {
      const payload = {
        company_name: formData.company_name,
        contact_name: formData.contact_name,
        phone: formData.phone,
        email: formData.email || null,
        area: formData.area || null,
        note: formData.note || null,
        status: formData.status,
      };
      const updated = await apiFetch(`/api/clients/${client.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast({ title: "Client updated", description: `${payload.company_name} has been updated.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update client." });
    } finally {
      setSaving(false);
    }
  };

  // ── selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((c) => prev.has(c.id));
      return allSelected ? new Set() : new Set(filtered.map((c) => c.id));
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── bulk actions ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map((id) => apiFetch(`/api/clients/${id}`, { method: "DELETE" })));
      const count = selectedIds.size;
      setClients((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      clearSelection();
      toast({ title: `${count} client${count !== 1 ? "s" : ""} deleted`, description: "Selected clients have been removed." });
    } catch (err) {
      toast({ variant: "destructive", title: "Bulk delete failed", description: err instanceof Error ? err.message : "Failed to delete selected clients." });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkStatusChange = async (status: "active" | "inactive", label: string) => {
    const eligible = filtered.filter((c) => selectedIds.has(c.id) && c.status !== status);
    if (!eligible.length) {
      toast({ variant: "destructive", title: "No eligible clients", description: `All selected clients are already ${status}.` });
      return;
    }
    setBulkProcessing(true);
    try {
      await Promise.all(eligible.map((c) => apiFetch(`/api/clients/${c.id}`, { method: "PATCH", body: JSON.stringify({ status }) })));
      await fetchClients();
      clearSelection();
      toast({ title: `${eligible.length} client${eligible.length !== 1 ? "s" : ""} ${label.toLowerCase()}d`, description: "Status updated successfully." });
    } catch (err) {
      toast({ variant: "destructive", title: `Bulk ${label.toLowerCase()} failed`, description: err instanceof Error ? err.message : "Failed to update clients." });
    } finally {
      setBulkProcessing(false);
    }
  };

  // ── export ────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = filtered.map((c) => ({
      "Company Name":  c.company_name,
      "Contact Name":  c.contact_name,
      "Phone":         c.phone,
      "Email":         c.email ?? "",
      "Area":          c.area ?? "",
      "Note":          c.note ?? "",
      "Status":        c.status === "active" ? "Active" : "Inactive",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.sheet_add_aoa(ws, [[`Total: ${filtered.length} client${filtered.length !== 1 ? "s" : ""}`]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exportTitle);
    XLSX.writeFile(wb, `${exportTitle.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
    setExportOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 14;

    const orgName = provider?.provider_name ?? "Clients Report";
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
    doc.setDrawColor(220); doc.line(14, y, 196, y); y += 5;

    doc.setFontSize(11); doc.setTextColor(22, 35, 24); doc.setFont("helvetica", "bold");
    doc.text(exportTitle, 14, y);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
    doc.text(`Exported ${format(new Date(), "d MMM yyyy")}`, 196, y, { align: "right" }); y += 5;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`${filtered.length} client${filtered.length !== 1 ? "s" : ""}`, 14, y); y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Company", "Contact", "Phone", "Email", "Area", "Status"]],
      body: filtered.map((c) => [
        c.company_name,
        c.contact_name,
        c.phone,
        c.email ?? "—",
        c.area ?? "—",
        c.status === "active" ? "Active" : "Inactive",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 35, 24] },
    });

    const orgSlug  = (provider?.provider_name ?? "clients").toLowerCase().replace(/\s+/g, "-");
    const fileSlug = exportTitle.toLowerCase().replace(/\s+/g, "-");
    doc.save(`${orgSlug}-${fileSlug}.pdf`);
    setExportOpen(false);
  };

  // ── import ────────────────────────────────────────────────────────────────
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
        const company  = (r["Company Name"] ?? r["company_name"] ?? "").toString().trim();
        const contact  = (r["Contact Name"] ?? r["contact_name"] ?? "").toString().trim();
        const rawPhone = (r["Phone"] ?? r["phone"] ?? "").toString().trim();
        const phone    = rawPhone && !rawPhone.startsWith("+") ? `+${rawPhone}` : rawPhone;
        const statusRaw = (r["Status"] ?? r["status"] ?? "").toString().toLowerCase().trim();
        const validStatus: "active" | "inactive" | null =
          statusRaw === "active" ? "active" : statusRaw === "inactive" ? "inactive" : null;
        return {
          row: i + 2,
          company_name: company,
          contact_name: contact,
          phone,
          email: (r["Email"] ?? r["email"] ?? "").toString().trim() || null,
          area:  (r["Area"]  ?? r["area"]  ?? "").toString().trim() || null,
          note:  (r["Note"]  ?? r["note"]  ?? "").toString().trim() || null,
          status: validStatus,
          missingCompany: !company,
          missingContact: !contact,
          missingPhone:   !phone,
          missingStatus:  validStatus === null,
        };
      });

      const invalidRows = parsed.filter((r) => r.missingCompany || r.missingContact || r.missingPhone || r.missingStatus);
      if (invalidRows.length) {
        const lines = invalidRows.map((r) => {
          const missing = [
            r.missingCompany && "Company Name",
            r.missingContact && "Contact Name",
            r.missingPhone   && "Phone",
            r.missingStatus  && "Status",
          ].filter(Boolean).join(", ");
          return `Row ${r.row}: missing ${missing}`;
        });
        setImportError({
          title: `Upload failed — ${invalidRows.length} row${invalidRows.length > 1 ? "s are" : " is"} missing required fields`,
          rows: lines,
        });
        return;
      }

      if (!parsed.length) {
        toast({ variant: "destructive", title: "No data found", description: "Make sure the sheet has data and a 'Company Name' column." });
        return;
      }

      let created = 0;
      const rowErrors: string[] = [];
      setImportProgress({ current: 0, total: parsed.length });
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        try {
          const result = await apiFetch("/api/clients", {
            method: "POST",
            body: JSON.stringify({
              company_name: row.company_name,
              contact_name: row.contact_name,
              phone:        row.phone,
              email:        row.email,
              area:         row.area,
              note:         row.note,
              status:       row.status,
            }),
          });
          setClients((prev) => [result, ...prev]);
          created++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const reason =
            msg.includes("phone") ? "phone number already exists" :
            msg.includes("email") ? "email already exists" :
            msg;
          rowErrors.push(`Row ${i + 2} (${row.company_name}): ${reason}`);
        }
        setImportProgress({ current: i + 1, total: parsed.length });
      }
      setImportProgress(null);
      window.dispatchEvent(new Event("navcount:refresh"));

      if (rowErrors.length) {
        setImportError({
          title: `${created} of ${parsed.length} imported — ${rowErrors.length} row${rowErrors.length !== 1 ? "s" : ""} failed`,
          rows: rowErrors,
        });
      } else {
        toast({ title: "Import successful", description: `${created} of ${parsed.length} client${parsed.length !== 1 ? "s" : ""} imported successfully.` });
      }
    } catch {
      setImportProgress(null);
      toast({ variant: "destructive", title: "Import failed", description: "Failed to read the file. Please use a valid Excel file." });
    } finally {
      setImporting(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col h-full">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-4 sm:px-8 py-4 sm:py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Clients</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage businesses and contacts you deliver for
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onClick={fetchClients} loading={loading} />

            {/* Hidden file input */}
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />

            {/* Import */}
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

            {/* Add client */}
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
              Add Client
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-2 grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
            {[
              { label: "Total Clients", value: tabCounts.all },
              { label: "Active",        value: tabCounts.active },
              { label: "Inactive",      value: tabCounts.inactive },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-100 bg-white px-3 sm:px-5 py-3 sm:py-4 shadow-sm">
                <p className="text-xs sm:text-sm text-gray-500 truncate">{s.label}</p>
                <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        {!loading && !error && (
          <div className="px-4 sm:px-8 pt-4 pb-3 space-y-2.5">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients, contacts, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
                {/* Select-all checkbox */}
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
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0"
                    style={
                      activeTab === tab.key
                        ? { backgroundColor: "#CDF782", color: "#162318" }
                        : { color: "#6b7280" }
                    }
                    onMouseEnter={(e) => { if (activeTab !== tab.key) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f3f4f6"; }}
                    onMouseLeave={(e) => { if (activeTab !== tab.key) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                  >
                    {tab.label}
                    {tab.key !== "all" && tabCounts[tab.key] > 0 && (
                      <span className="ml-1.5 text-xs opacity-60">({tabCounts[tab.key]})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Bulk action bar */}
            {someFilteredSelected && (
              <div>
                <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2 shadow-sm text-sm">
                  <span className="font-semibold text-gray-700">{selectedIds.size} selected</span>
                  <div className="h-4 w-px bg-gray-200" />
                  <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "activate" })}
                    className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors">
                    Activate
                  </button>
                  <button type="button" disabled={bulkProcessing} onClick={() => setConfirmBulkAction({ type: "deactivate" })}
                    className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors">
                    Deactivate
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
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading clients...</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-sm font-medium text-red-600">Failed to load clients</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchClients}>Try again</Button>
          </div>

        ) : clients.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No clients yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add the businesses and contacts you deliver for to start managing your clients.
                </p>
              </div>
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
                <Plus className="h-4 w-4" />
                Add your first client
              </button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No clients found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : viewMode === "grid" ? (
          <GridView clients={filtered} selectedIds={selectedIds} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onToggleSelect={toggleSelect} />
        ) : (
          <ListView clients={filtered} selectedIds={selectedIds} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onToggleSelect={toggleSelect} />
        )}
      </div>

      <ClientViewModal
        client={selectedClient}
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        onEdit={() => handleEdit(selectedClient!)}
      />

      <ClientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        client={selectedClient}
        saving={saving}
      />

      {/* Import progress */}
      {importProgress && (
        <ImportProgressModal current={importProgress.current} total={importProgress.total} />
      )}

      {/* Import error */}
      {importError && (
        <ImportErrorModal title={importError.title} rows={importError.rows} onClose={() => setImportError(null)} />
      )}

      {/* Import guide */}
      <ImportGuideModal
        isOpen={importGuideOpen}
        onClose={() => setImportGuideOpen(false)}
        onProceed={() => { setImportGuideOpen(false); importRef.current?.click(); }}
      />

      {/* Update confirm modal */}
      {confirmUpdate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmUpdate(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Do you want to save changes to {confirmUpdate.client.company_name}?
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

      {/* Single delete confirm */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-red-600">Do you want to delete {confirmDelete.company_name}?</h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button type="button" onClick={() => executeDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 transition-colors">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action confirm */}
      {confirmBulkAction !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmBulkAction(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className={`text-sm font-semibold ${confirmBulkAction.type === "delete" ? "text-red-600" : "text-gray-900"}`}>
                {confirmBulkAction.type === "delete"
                  ? `Do you want to delete ${selectedIds.size} client${selectedIds.size !== 1 ? "s" : ""}?`
                  : confirmBulkAction.type === "activate"
                  ? `Do you want to activate ${selectedIds.size} client${selectedIds.size !== 1 ? "s" : ""}?`
                  : `Do you want to deactivate ${selectedIds.size} client${selectedIds.size !== 1 ? "s" : ""}?`}
              </h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={() => {
                  const action = confirmBulkAction;
                  setConfirmBulkAction(null);
                  if (action.type === "delete") handleBulkDelete();
                  else if (action.type === "activate") handleBulkStatusChange("active", "Activate");
                  else handleBulkStatusChange("inactive", "Deactivate");
                }}
                className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 hover:opacity-90 ${
                  confirmBulkAction.type === "delete" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                }`}
                style={confirmBulkAction.type !== "delete" ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
              >
                {bulkProcessing ? "Processing…"
                  : confirmBulkAction.type === "delete" ? "Delete"
                  : confirmBulkAction.type === "activate" ? "Activate"
                  : "Deactivate"}
              </button>
              <button type="button" onClick={() => setConfirmBulkAction(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Grid view ─────────────────────────────────────────────────────────────── */

function GridView({ clients, selectedIds, onView, onEdit, onDelete, onToggleSelect }: {
  clients: Client[]; selectedIds: Set<number>;
  onView: (c: Client) => void; onEdit: (c: Client) => void;
  onDelete: (c: Client) => void; onToggleSelect: (id: number) => void;
}) {
  return (
    <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((c) => (
        <ClientCard key={c.id} client={c} selectedIds={selectedIds} onView={onView} onEdit={onEdit} onDelete={onDelete} onToggleSelect={onToggleSelect} />
      ))}
    </div>
  );
}

function ClientCard({ client: c, selectedIds, onView, onEdit, onDelete, onToggleSelect }: {
  client: Client; selectedIds: Set<number>;
  onView: (c: Client) => void; onEdit: (c: Client) => void;
  onDelete: (c: Client) => void; onToggleSelect: (id: number) => void;
}) {
  const colors = avatarColor(c.id);
  const isSelected = selectedIds.has(c.id);
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col"
      style={{ border: isSelected ? "1.5px solid #10B981" : "1px solid #e5e7eb" }}>
      <div className="relative">
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          <button type="button" onClick={() => onDelete(c)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onToggleSelect(c.id)}
            className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"}`}>
            {isSelected && (
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <button onClick={() => onView(c)} className="text-left focus:outline-none w-full">
          <div className="px-5 pt-5 pb-0 flex items-center gap-3">
            <div className={`h-10 w-10 shrink-0 rounded-full ${colors.bg} ${colors.text} text-sm font-bold flex items-center justify-center`}>
              {getInitials(c.company_name)}
            </div>
            <span className="text-sm font-medium text-gray-500">{clientCode(c.id)}</span>
          </div>
          <div className="px-5 pt-3 pb-0">
            <p className="text-lg font-bold text-gray-900 leading-tight truncate pr-20">{c.company_name}</p>
            <p className="mt-0.5 text-sm text-gray-400 truncate">{c.contact_name}</p>
            <div className="mt-2.5 pb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                {c.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            <CardDetailRow label="PHONE" value={c.phone} />
            <CardDetailRow label="EMAIL" value={c.email} />
            <CardDetailRow label="AREA"  value={c.area}  bold />
            <CardDetailRow label="NOTE"  value={c.note}  italic />
          </div>
        </button>
      </div>
      <div className="border-t border-gray-100 grid grid-cols-2 gap-3 px-4 py-3 mt-auto">
        <button onClick={() => onView(c)}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          <Eye className="h-4 w-4" /> View
        </button>
        <button onClick={() => onEdit(c)}
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#CDF782", color: "#162318" }}>
          <Pencil className="h-4 w-4" /> Edit
        </button>
      </div>
    </div>
  );
}

function CardDetailRow({ label, value, bold = false, italic = false }: {
  label: string; value: string | null | undefined; bold?: boolean; italic?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 pt-px">{label}</span>
      <span className={`text-sm text-right truncate max-w-[200px] ${italic ? "italic text-gray-500" : bold ? "font-semibold text-gray-800" : "text-gray-800"} ${!value ? "text-gray-300 not-italic font-normal" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

/* ─── List view ──────────────────────────────────────────────────────────────── */

function ListView({ clients, selectedIds, onView, onEdit, onDelete, onToggleSelect }: {
  clients: Client[]; selectedIds: Set<number>;
  onView: (c: Client) => void; onEdit: (c: Client) => void;
  onDelete: (c: Client) => void; onToggleSelect: (id: number) => void;
}) {
  return (
    <div className="px-4 sm:px-8 pb-8 overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200">
            {["", "COMPANY", "CONTACT", "PHONE", "EMAIL", "ADDRESS", "STATUS", "ACTIONS"].map((h) => (
              <th key={h} className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 first:pl-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map((c) => (
            <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedIds.has(c.id) ? "bg-emerald-50/50" : ""}`}>
              <td className="py-3.5 pr-2 w-6">
                <button type="button" onClick={() => onToggleSelect(c.id)}
                  className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${selectedIds.has(c.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"}`}>
                  {selectedIds.has(c.id) && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </td>
              <td className="py-3.5 pr-4">
                <button onClick={() => onView(c)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
                  <div className={`h-9 w-9 shrink-0 rounded-full ${avatarColor(c.id).bg} ${avatarColor(c.id).text} text-xs font-bold flex items-center justify-center`}>
                    {getInitials(c.company_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.company_name}</p>
                    {c.note && <p className="text-xs text-gray-400 italic truncate max-w-[180px]">{c.note}</p>}
                  </div>
                </button>
              </td>
              <td className="py-3.5 pr-4 text-sm text-gray-700">{c.contact_name}</td>
              <td className="py-3.5 pr-4 text-sm text-gray-700 whitespace-nowrap">{c.phone}</td>
              <td className="py-3.5 pr-4 text-sm text-gray-500 max-w-[180px] truncate">{c.email || <span className="text-gray-300">—</span>}</td>
              <td className="py-3.5 pr-4 text-sm text-gray-600 whitespace-nowrap">{c.area || <span className="text-gray-300">—</span>}</td>
              <td className="py-3.5 pr-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {c.status === "active" ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="py-3.5">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => onView(c)} title="View" className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><Eye className="h-4 w-4" /></button>
                  <button onClick={() => onEdit(c)} title="Edit" className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => onDelete(c)} title="Delete" className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Import Progress Modal ──────────────────────────────────────────────────── */

function ImportProgressModal({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 px-8 py-8">
        <div className="flex justify-center mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
            <Upload className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="text-center mb-6">
          <h3 className="text-sm font-semibold text-gray-900">Importing clients…</h3>
          <p className="mt-1 text-xs text-gray-400">{current} of {total} row{total !== 1 ? "s" : ""} processed</p>
        </div>
        <div className="w-full rounded-full bg-gray-100 h-2.5 overflow-hidden">
          <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: "#CDF782" }} />
        </div>
        <p className="mt-2 text-right text-xs font-semibold text-gray-500">{pct}%</p>
      </div>
    </div>
  );
}

/* ─── Import Error Modal ─────────────────────────────────────────────────────── */

function ImportErrorModal({ title, rows, onClose }: { title: string; rows: string[]; onClose: () => void }) {
  const isPartial = !title.startsWith("Upload failed");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
        <div className={`flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b ${isPartial ? "border-amber-100 bg-amber-50" : "border-red-100 bg-red-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border ${isPartial ? "border-amber-200" : "border-red-200"}`}>
              <X className={`h-5 w-5 ${isPartial ? "text-amber-500" : "text-red-500"}`} />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isPartial ? "text-amber-700" : "text-red-700"}`}>
                {isPartial ? "Import completed with errors" : "Upload Failed"}
              </h3>
              <p className={`text-xs mt-0.5 ${isPartial ? "text-amber-600" : "text-red-500"}`}>{title}</p>
            </div>
          </div>
          <button onClick={onClose} className={`shrink-0 transition-colors rounded-md p-1 ${isPartial ? "text-amber-400 hover:text-amber-600 hover:bg-amber-100" : "text-red-400 hover:text-red-600 hover:bg-red-100"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-gray-500">{isPartial ? "The following rows could not be imported:" : "The following rows have missing required fields:"}</p>
          <div className={`rounded-xl border divide-y max-h-52 overflow-y-auto ${isPartial ? "border-amber-100 bg-amber-50 divide-amber-100" : "border-red-100 bg-red-50 divide-red-100"}`}>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isPartial ? "bg-amber-400" : "bg-red-400"}`} />
                <span className={`text-xs ${isPartial ? "text-amber-700" : "text-red-700"}`}>{row}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {isPartial
              ? "Successfully imported clients have been added. Fix the issues above and re-import the failed rows."
              : "Please update your file with the missing values and try uploading again."}
          </p>
        </div>
        <div className="px-6 pb-6 pt-1">
          <button onClick={onClose}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#162318", backgroundColor: "#CDF782", border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            Got it, I&apos;ll fix the file
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Import Guide Modal ─────────────────────────────────────────────────────── */

const CLIENT_IMPORT_COLUMNS = [
  { name: "Company Name", required: true,  example: "Baobab Bakehouse" },
  { name: "Contact Name", required: true,  example: "Zuri Kamau" },
  { name: "Phone",        required: true,  example: "+254712345678" },
  { name: "Status",       required: true,  example: "Active / Inactive" },
  { name: "Email",        required: false, example: "orders@bakehouse.co.ke" },
  { name: "Area",         required: false, example: "Karen, Nairobi" },
  { name: "Note",         required: false, example: "Daily bakery runs, 6am drops" },
];

function ImportGuideModal({ isOpen, onClose, onProceed }: { isOpen: boolean; onClose: () => void; onProceed: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
              <Upload className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Import Clients</h3>
              <p className="text-xs text-gray-400 mt-0.5">Prepare your Excel file using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <span className="text-base">📋</span>
            <p className="text-xs text-blue-700">Accepted file types: <strong>.xlsx</strong> or <strong>.xls</strong>. The first sheet will be used.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Column format</p>
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
                  {CLIENT_IMPORT_COLUMNS.map((col) => (
                    <tr key={col.name}>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{col.name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {col.required
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Required</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"><span className="h-1.5 w-1.5 rounded-full bg-gray-300 inline-block" />Optional</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 italic">{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <span className="text-base mt-0.5">💡</span>
            <p className="text-xs text-amber-700">
              Column names must match exactly as shown. Status must be <strong>Active</strong> or <strong>Inactive</strong>.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 pt-1 flex gap-2">
          <button
            onClick={onProceed}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#162318", backgroundColor: "#CDF782", border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            <Upload className="h-4 w-4" />
            Browse File
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-[10px] border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
