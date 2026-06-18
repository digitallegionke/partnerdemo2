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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientModal from "@/components/ClientModal";
import ClientViewModal from "@/components/ClientViewModal";
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

  const handleDelete = async (c: Client) => {
    if (!confirm(`Delete "${c.company_name}"? This cannot be undone.`)) return;
    try {
      const auth = await getAuthHeader();
      await fetch(`/api/clients/${c.id}`, {
        method: "DELETE",
        headers: { Authorization: auth },
      });
      setClients((prev) => prev.filter((x) => x.id !== c.id));
    } catch {
      alert("Failed to delete client. Please try again.");
    }
  };

  const handleSave = async (formData: ClientFormData) => {
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

      if (selectedClient) {
        const updated = await apiFetch(`/api/clients/${selectedClient.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await apiFetch("/api/clients", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setClients((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: clients.length,
      active: 0,
      inactive: 0,
    };
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

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 border-b px-8 py-5">
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
          <div className="px-8 pt-6 pb-2 grid grid-cols-3 gap-4 max-w-2xl">
            {[
              { label: "Total Clients", value: tabCounts.all },
              { label: "Active",        value: tabCounts.active },
              { label: "Inactive",      value: tabCounts.inactive },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + tabs + view toggle */}
        {!loading && !error && (
          <div className="px-8 pt-4 pb-3 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients, contacts, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                  {tab.key !== "all" && tabCounts[tab.key] > 0 && (
                    <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-white/70" : "text-gray-400"}`}>
                      ({tabCounts[tab.key]})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="ml-auto flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "grid" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "list" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
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
              <Button onClick={handleAdd} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="h-4 w-4" />
                Add your first client
              </Button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No clients found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : viewMode === "grid" ? (
          <GridView clients={filtered} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
        ) : (
          <ListView clients={filtered} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
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
    </>
  );
}

/* ─── Grid view ─── */

function GridView({
  clients,
  onView,
  onEdit,
  onDelete,
}: {
  clients: Client[];
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((c) => (
        <ClientCard key={c.id} client={c} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function ClientCard({
  client: c,
  onView,
  onEdit,
  onDelete,
}: {
  client: Client;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const colors = avatarColor(c.id);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">

      {/* Clickable top section → opens view modal */}
      <button
        onClick={() => onView(c)}
        className="text-left focus:outline-none"
      >
        {/* Top row: avatar + code + status */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 shrink-0 rounded-full ${colors.bg} ${colors.text} text-sm font-bold flex items-center justify-center`}
            >
              {getInitials(c.company_name)}
            </div>
            <span className="text-sm font-medium text-gray-500">{clientCode(c.id)}</span>
          </div>
          <span
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
              c.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                c.status === "active" ? "bg-emerald-500" : "bg-gray-400"
              }`}
            />
            {c.status === "active" ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Company + contact */}
        <div className="px-5 pb-4">
          <p className="text-lg font-bold text-gray-900 leading-tight">{c.company_name}</p>
          <p className="mt-0.5 text-sm text-gray-400">{c.contact_name}</p>
        </div>

        {/* Details */}
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          <CardDetailRow label="PHONE" value={c.phone} />
          <CardDetailRow label="EMAIL" value={c.email} />
          <CardDetailRow label="AREA"  value={c.area}  bold />
          <CardDetailRow label="NOTE"  value={c.note}  italic />
        </div>
      </button>

      {/* Actions */}
      <div className="border-t border-gray-100 grid grid-cols-2 gap-3 px-4 py-4 mt-auto">
        <button
          onClick={() => onEdit(c)}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Pencil className="h-4 w-4" />
          EDIT
        </button>
        <button
          onClick={() => onDelete(c)}
          className="flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          DELETE
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
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 pt-px">
        {label}
      </span>
      <span
        className={`text-sm text-right truncate max-w-[200px] ${
          italic ? "italic text-gray-500" : bold ? "font-semibold text-gray-800" : "text-gray-800"
        } ${!value ? "text-gray-300 not-italic font-normal" : ""}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/* ─── List / Table view ─── */

function ListView({
  clients,
  onView,
  onEdit,
  onDelete,
}: {
  clients: Client[];
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <div className="px-8 pb-8 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            {["COMPANY", "CONTACT", "PHONE", "EMAIL", "ADDRESS", "STATUS", "ACTIONS"].map(
              (h) => (
                <th
                  key={h}
                  className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 first:pl-0"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
              {/* Company */}
              <td className="py-3.5 pr-4">
                <button
                  onClick={() => onView(c)}
                  className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                >
                  <div
                    className={`h-9 w-9 shrink-0 rounded-full ${avatarColor(c.id).bg} ${avatarColor(c.id).text} text-xs font-bold flex items-center justify-center`}
                  >
                    {getInitials(c.company_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.company_name}</p>
                    {c.note && (
                      <p className="text-xs text-gray-400 italic truncate max-w-[180px]">{c.note}</p>
                    )}
                  </div>
                </button>
              </td>

              {/* Contact */}
              <td className="py-3.5 pr-4 text-sm text-gray-700">{c.contact_name}</td>

              {/* Phone */}
              <td className="py-3.5 pr-4 text-sm text-gray-700 whitespace-nowrap">{c.phone}</td>

              {/* Email */}
              <td className="py-3.5 pr-4 text-sm text-gray-500 max-w-[180px] truncate">
                {c.email || <span className="text-gray-300">—</span>}
              </td>

              {/* Address / Area */}
              <td className="py-3.5 pr-4 text-sm text-gray-600 whitespace-nowrap">
                {c.area || <span className="text-gray-300">—</span>}
              </td>

              {/* Status */}
              <td className="py-3.5 pr-4">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    c.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      c.status === "active" ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  {c.status === "active" ? "Active" : "Inactive"}
                </span>
              </td>

              {/* Actions */}
              <td className="py-3.5">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onView(c)}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    onClick={() => onEdit(c)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(c)}
                    className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
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
