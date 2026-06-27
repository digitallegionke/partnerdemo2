"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  Search,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientModal from "@/components/ClientModal";
import ClientViewModal from "@/components/ClientViewModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type Client = Database["public"]["Tables"]["partner_clients"]["Row"];
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

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function clientCode(id: number) {
  return `cl-${String(id).padStart(3, "0")}`;
}

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
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState("");
  const [activeTab, setActiveTab]           = useState<FilterTab>("all");
  const [viewMode, setViewMode]             = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen]           = useState(false);
  const [viewOpen, setViewOpen]             = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saving, setSaving]                 = useState(false);

  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState<Client | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<
    { type: "delete" } | { type: "activate" } | { type: "deactivate" } | null
  >(null);
  const [confirmUpdate, setConfirmUpdate] = useState<{ client: Client; formData: ClientFormData } | null>(null);

  const { toast } = useToast();

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
      // Intercept update — show confirm modal first
      setModalOpen(false);
      setConfirmUpdate({ client: selectedClient, formData });
      return;
    }
    // Create — execute immediately
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
      const created = await apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      });
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
      const updated = await apiFetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast({ title: "Client updated", description: `${payload.company_name} has been updated.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update client." });
    } finally {
      setSaving(false);
    }
  };

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
          (c.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, activeTab, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someFilteredSelected = filtered.some((c) => selectedIds.has(c.id));

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((c) => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((c) => c.id));
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

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
            {/* Row 1: Search */}
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

            {/* Row 2: Select-all + Tabs + view toggle */}
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
                    onMouseEnter={(e) => {
                      if (activeTab !== tab.key)
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab.key)
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                    }}
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
                  <button type="button" disabled={bulkProcessing}
                    onClick={() => setConfirmBulkAction({ type: "activate" })}
                    className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors">
                    Activate
                  </button>
                  <button type="button" disabled={bulkProcessing}
                    onClick={() => setConfirmBulkAction({ type: "deactivate" })}
                    className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors">
                    Deactivate
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

      {/* Single delete confirm modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-sm font-semibold text-red-600">Do you want to delete {confirmDelete.company_name}?</h3>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                onClick={() => executeDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
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
    </>
  );
}

/* ─── Grid view ─── */

function GridView({
  clients,
  selectedIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
}: {
  clients: Client[];
  selectedIds: Set<number>;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
  onToggleSelect: (id: number) => void;
}) {
  return (
    <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((c) => (
        <ClientCard key={c.id} client={c} selectedIds={selectedIds} onView={onView} onEdit={onEdit} onDelete={onDelete} onToggleSelect={onToggleSelect} />
      ))}
    </div>
  );
}

function ClientCard({
  client: c,
  selectedIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
}: {
  client: Client;
  selectedIds: Set<number>;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
  onToggleSelect: (id: number) => void;
}) {
  const colors = avatarColor(c.id);
  const isSelected = selectedIds.has(c.id);

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col"
      style={{ border: isSelected ? "1.5px solid #10B981" : "1px solid #e5e7eb" }}
    >
      {/* Top-right: trash + edit + checkbox */}
      <div className="relative">
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
          <button
            type="button"
            onClick={() => onDelete(c)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleSelect(c.id)}
            className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
              isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
            }`}
          >
            {isSelected && (
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Clickable top section → opens view modal */}
        <button onClick={() => onView(c)} className="text-left focus:outline-none w-full">
          {/* Avatar + code row */}
          <div className="px-5 pt-5 pb-0 flex items-center gap-3">
            <div className={`h-10 w-10 shrink-0 rounded-full ${colors.bg} ${colors.text} text-sm font-bold flex items-center justify-center`}>
              {getInitials(c.company_name)}
            </div>
            <span className="text-sm font-medium text-gray-500">{clientCode(c.id)}</span>
          </div>

          {/* Company name + contact */}
          <div className="px-5 pt-3 pb-0">
            <p className="text-lg font-bold text-gray-900 leading-tight truncate pr-20">{c.company_name}</p>
            <p className="mt-0.5 text-sm text-gray-400 truncate">{c.contact_name}</p>
            <div className="mt-2.5 pb-4">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                {c.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            <CardDetailRow label="PHONE" value={c.phone} />
            <CardDetailRow label="EMAIL" value={c.email} />
            <CardDetailRow label="AREA"  value={c.area}  bold />
            <CardDetailRow label="NOTE"  value={c.note}  italic />
          </div>
        </button>
      </div>

      {/* Actions footer */}
      <div className="border-t border-gray-100 grid grid-cols-2 gap-3 px-4 py-3 mt-auto">
        <button
          onClick={() => onView(c)}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Eye className="h-4 w-4" />
          View
        </button>
        <button
          onClick={() => onEdit(c)}
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#CDF782", color: "#162318" }}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
      </div>
    </div>
  );
}

function CardDetailRow({
  label,
  value,
  bold = false,
  italic = false,
}: {
  label: string;
  value: string | null | undefined;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 pt-px">{label}</span>
      <span className={`text-sm text-right truncate max-w-[200px] ${
        italic ? "italic text-gray-500" : bold ? "font-semibold text-gray-800" : "text-gray-800"
      } ${!value ? "text-gray-300 not-italic font-normal" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

/* ─── List / Table view ─── */

function ListView({
  clients,
  selectedIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
}: {
  clients: Client[];
  selectedIds: Set<number>;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
  onToggleSelect: (id: number) => void;
}) {
  return (
    <div className="px-4 sm:px-8 pb-8 overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200">
            {["", "COMPANY", "CONTACT", "PHONE", "EMAIL", "ADDRESS", "STATUS", "ACTIONS"].map((h) => (
              <th key={h} className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map((c) => (
            <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedIds.has(c.id) ? "bg-emerald-50/50" : ""}`}>
              {/* Checkbox */}
              <td className="py-3.5 pr-2 w-6">
                <button
                  type="button"
                  onClick={() => onToggleSelect(c.id)}
                  className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                    selectedIds.has(c.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                  }`}
                >
                  {selectedIds.has(c.id) && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </td>

              {/* Company */}
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
              <td className="py-3.5 pr-4 text-sm text-gray-500 max-w-[180px] truncate">
                {c.email || <span className="text-gray-300">—</span>}
              </td>
              <td className="py-3.5 pr-4 text-sm text-gray-600 whitespace-nowrap">
                {c.area || <span className="text-gray-300">—</span>}
              </td>

              {/* Status */}
              <td className="py-3.5 pr-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {c.status === "active" ? "Active" : "Inactive"}
                </span>
              </td>

              {/* Actions */}
              <td className="py-3.5">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => onView(c)} title="View" className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => onEdit(c)} title="Edit" className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDelete(c)} title="Delete" className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
