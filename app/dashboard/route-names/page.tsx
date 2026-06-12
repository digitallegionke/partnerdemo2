"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { format } from "date-fns";

type RouteName = Database["public"]["Tables"]["partner_route_names"]["Row"];

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
  const [routeNames, setRouteNames]   = useState<RouteName[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingItem, setEditingItem] = useState<RouteName | null>(null);
  const [saving, setSaving]           = useState(false);

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

  const handleAdd = () => { setEditingItem(null); setModalOpen(true); };

  const handleRename = (item: RouteName) => { setEditingItem(item); setModalOpen(true); };

  const handleDelete = async (item: RouteName) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      const auth = await getAuthHeader();
      await fetch(`/api/route-names/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: auth },
      });
      setRouteNames((prev) => prev.filter((r) => r.id !== item.id));
    } catch {
      alert("Failed to delete route name. Please try again.");
    }
  };

  const handleSave = async (name: string, notes: string) => {
    setSaving(true);
    try {
      if (editingItem) {
        const updated = await apiFetch(`/api/route-names/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, notes }),
        });
        setRouteNames((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await apiFetch("/api/route-names", {
          method: "POST",
          body: JSON.stringify({ name, notes }),
        });
        setRouteNames((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save route name");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return routeNames;
    const q = search.toLowerCase();
    return routeNames.filter((r) => r.name.toLowerCase().includes(q));
  }, [routeNames, search]);

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-8 py-5">
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
          <Button
            onClick={handleAdd}
            className="shrink-0 gap-2 bg-emerald-700 hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            New Route Name
          </Button>
        </div>

        {/* Search */}
        {!loading && !error && (
          <div className="px-8 pt-5 pb-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search route names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
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

        ) : (
          <div className="px-8 pb-8 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4">
                    Route Name
                  </th>
                  <th className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4">
                    Notes
                  </th>
                  <th className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4">
                    Added
                  </th>
                  <th className="pb-3 pt-1 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* Route name */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100">
                          <MapPin className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 pr-4 text-sm text-gray-500 max-w-[260px]">
                      {item.notes
                        ? <span className="italic truncate block">{item.notes}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>

                    {/* Added date */}
                    <td className="py-3.5 pr-4 text-sm text-gray-500 whitespace-nowrap">
                      {format(new Date(item.created_at), "d MMM yyyy")}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRename(item)}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer count */}
            <p className="mt-4 text-xs text-gray-400">
              {filtered.length} route {filtered.length === 1 ? "name" : "names"}
            </p>
          </div>
        )}
      </div>

      {/* Add / Rename modal */}
      <RouteNameModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        item={editingItem}
        saving={saving}
      />
    </>
  );
}

/* ─── Modal ─── */

function RouteNameModal({
  isOpen,
  onClose,
  onSave,
  item,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, notes: string) => void;
  item: RouteName | null;
  saving: boolean;
}) {
  const [name, setName]   = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(item?.name ?? "");
      setNotes(item?.notes ?? "");
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), notes.trim());
  };

  const isRename = item !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-200 shadow-sm">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {isRename ? "Rename Route" : "New Route Name"}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {isRename ? "Update the name for this route" : "Add a name to the route registry"}
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

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Notes
                <span className="ml-1 text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this route..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="px-6 pb-6 pt-5 space-y-2">
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 transition-colors"
            >
              {saving ? (
                "Saving..."
              ) : isRename ? (
                "Rename Route"
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
