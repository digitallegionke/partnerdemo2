"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Route, Plus, Pencil, Search, X, MapPin, Clock, User,
  Navigation, Trash2, Map, RefreshCw, AlertCircle,
  CheckCircle2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AddressSearch from "@/components/address-search";
import RouteMapScreen from "@/app/screens/route-map-screen";
import { supabase, parsePointCoordinates } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

type RouteStatus = "active" | "completed" | "pending" | "cancelled";

type PartnerRoute = {
  id: number;
  name: string;
  status: RouteStatus;
  driver_id: number | null;
  start_location: string | null;
  end_location: string | null;
  total_distance: number | null;
  estimated_duration: number | null;
  efficiency_score: number | null;
  lat: string;
  lng: string;
  created_at: string;
  updated_at: string;
  provider_id: number;
  driver: { id: number; name: string } | null;
  delivery_count: number;
};

type Delivery = {
  id: number;
  route_id: number | null;
  customer_name: string;
  location: string;
  coordinates: string | number[] | object;
  item: string;
  phone: string;
  drop_time: string;
  status: string;
  order_index: number | null;
  estimated_value: string | null;
  weight: string | null;
  delivery_notes: string | null;
};

type DeliveryForm = {
  localId: number;
  customer_name: string;
  location: string;
  lat: string;
  lng: string;
  item: string;
  phone: string;
  drop_time: string;
  estimated_value: string;
  weight: string;
  delivery_notes: string;
};

type FormState = {
  name: string;
  start_location: string;
  start_lat: string;
  start_lng: string;
  end_location: string;
  end_lat: string;
  end_lng: string;
  driver_id: string;
  status: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "pending",   label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-700",
  completed: "bg-blue-50 text-blue-700",
  pending:   "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
};

const STATUS_DOT: Record<string, string> = {
  active:    "bg-emerald-500",
  completed: "bg-blue-500",
  pending:   "bg-amber-400",
  cancelled: "bg-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  active:    "Active",
  completed: "Completed",
  pending:   "Pending",
  cancelled: "Cancelled",
};

const EMPTY_FORM: FormState = {
  name: "",
  start_location: "",
  start_lat: "",
  start_lng: "",
  end_location: "",
  end_lat: "",
  end_lng: "",
  driver_id: "",
  status: "pending",
};

const newDeliveryForm = (): DeliveryForm => ({
  localId: Date.now() + Math.random(),
  customer_name: "",
  location: "",
  lat: "",
  lng: "",
  item: "",
  phone: "",
  drop_time: "",
  estimated_value: "",
  weight: "",
  delivery_notes: "",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  // View: list or map
  const [view, setView]           = useState<"list" | "map">("list");
  const [mapRoute, setMapRoute]   = useState<any>(null);
  const [mapDeliveries, setMapDeliveries] = useState<any[]>([]);

  // Data
  const [routes, setRoutes]       = useState<PartnerRoute[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [drivers, setDrivers]     = useState<any[]>([]);

  // Filter / search
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch]       = useState("");

  // Modal
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<PartnerRoute | null>(null);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<number | null>(null);

  // Deliveries in create/edit modal
  const [deliveryMode, setDeliveryMode]       = useState<"new" | "existing">("new");
  const [newDeliveries, setNewDeliveries]     = useState<DeliveryForm[]>([newDeliveryForm()]);
  const [unassigned, setUnassigned]           = useState<Delivery[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<Set<number>>(new Set());
  const [routeDeliveries, setRouteDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRoutes = async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/routes");
      setRoutes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const data = await apiFetch("/api/drivers");
      setDrivers(Array.isArray(data) ? data : []);
    } catch { /* non-blocking */ }
  };

  const fetchUnassigned = async () => {
    try {
      const data = await apiFetch("/api/deliveries/unassigned");
      setUnassigned(data?.deliveries ?? []);
    } catch { /* non-blocking */ }
  };

  const fetchRouteDeliveries = async (routeId: number) => {
    setLoadingDeliveries(true);
    try {
      const data = await apiFetch(`/api/deliveries?route_id=${routeId}`);
      setRouteDeliveries(Array.isArray(data) ? data : []);
    } catch { /* non-blocking */ }
    finally { setLoadingDeliveries(false); }
  };

  useEffect(() => {
    fetchRoutes();
    fetchDrivers();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? routes : routes.filter((r) => r.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        (r.start_location ?? "").toLowerCase().includes(q) ||
        (r.end_location ?? "").toLowerCase().includes(q) ||
        (r.driver?.name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [routes, activeTab, search]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: routes.length, active: 0, pending: 0, completed: 0, cancelled: 0 };
    routes.forEach((r) => { if (r.status in c) c[r.status]++; });
    return c;
  }, [routes]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setNewDeliveries([newDeliveryForm()]);
    setDeliveryMode("new");
    setSelectedExisting(new Set());
    setRouteDeliveries([]);
    fetchUnassigned();
    setModalOpen(true);
  };

  const openEdit = async (route: PartnerRoute) => {
    setEditing(route);
    setForm({
      name: route.name,
      start_location: route.start_location ?? "",
      start_lat: "",
      start_lng: "",
      end_location: route.end_location ?? "",
      end_lat: "",
      end_lng: "",
      driver_id: route.driver_id ? String(route.driver_id) : "",
      status: route.status,
    });
    setFormError(null);
    setDeliveryMode("existing");
    setSelectedExisting(new Set());
    await Promise.all([fetchRouteDeliveries(route.id), fetchUnassigned()]);
    setModalOpen(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Route name is required."); return; }
    setSaving(true);
    setFormError(null);

    try {
      const payload: any = {
        name: form.name.trim(),
        start_location: form.start_location || null,
        end_location: form.end_location || null,
        driver_id: form.driver_id ? parseInt(form.driver_id) : null,
        status: form.status,
        lat: form.start_lat || "0",
        lng: form.start_lng || "0",
      };

      if (editing) {
        const updated = await apiFetch(`/api/routes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === updated.id
              ? { ...updated, driver: r.driver, delivery_count: r.delivery_count }
              : r
          )
        );
        setModalOpen(false);
      } else {
        const created = await apiFetch("/api/routes", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (deliveryMode === "new") {
          const valid = newDeliveries.filter(
            (d) => d.customer_name && d.location && d.lat && d.lng && d.phone && d.item && d.drop_time
          );
          for (let i = 0; i < valid.length; i++) {
            const d = valid[i];
            await apiFetch("/api/deliveries", {
              method: "POST",
              body: JSON.stringify({
                customer_name: d.customer_name,
                location: d.location,
                coordinates: [parseFloat(d.lat), parseFloat(d.lng)],
                item: d.item,
                phone: d.phone,
                drop_time: d.drop_time,
                estimated_value: d.estimated_value || null,
                weight: d.weight || null,
                delivery_notes: d.delivery_notes || null,
                route_id: created.id,
                order_index: i,
                status: "pending",
              }),
            });
          }
        } else {
          for (const deliveryId of Array.from(selectedExisting)) {
            await apiFetch(`/api/deliveries/${deliveryId}`, {
              method: "PATCH",
              body: JSON.stringify({ route_id: created.id }),
            });
          }
        }

        await fetchRoutes();
        setModalOpen(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save route");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (route: PartnerRoute) => {
    if (!confirm(`Delete route "${route.name}"? All linked deliveries will be unassigned.`)) return;
    setDeletingId(route.id);
    try {
      await apiFetch(`/api/routes/${route.id}`, { method: "DELETE" });
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete route");
    } finally {
      setDeletingId(null);
    }
  };

  // ── View map ───────────────────────────────────────────────────────────────

  const handleViewMap = async (route: PartnerRoute) => {
    try {
      const deliveriesData: Delivery[] = await apiFetch(`/api/deliveries?route_id=${route.id}`);

      const formatted = deliveriesData.map((d) => ({
        id: d.id,
        customer_name: d.customer_name,
        location: d.location,
        coordinates: parsePointCoordinates(d.coordinates) as [number, number],
        item: d.item,
        estimated_value: d.estimated_value,
        weight: d.weight,
        phone: d.phone,
        drop_time: d.drop_time,
        status: d.status as "pending" | "in-progress" | "completed" | "failed",
      }));

      const routeForMap = {
        id: route.id,
        name: route.name,
        distance: route.total_distance ? `${route.total_distance.toFixed(1)} km` : "0.0 km",
        duration: route.estimated_duration ? formatDuration(route.estimated_duration) : "0m",
        stops: formatted.length,
        status: route.status,
        driver: route.driver
          ? { id: route.driver.id, name: route.driver.name, phone: "", vehicle_type: "" }
          : null,
        lastUpdated: new Date(route.updated_at).toLocaleDateString(),
        efficiency: route.efficiency_score || 0,
        start_location: route.start_location,
        end_location: route.end_location,
      };

      setMapRoute(routeForMap);
      setMapDeliveries(formatted);
      setView("map");
    } catch {
      alert("Failed to load route deliveries");
    }
  };

  // ── Delivery form helpers ──────────────────────────────────────────────────

  const addNewDelivery = () => setNewDeliveries((prev) => [...prev, newDeliveryForm()]);

  const removeNewDelivery = (localId: number) => {
    if (newDeliveries.length > 1) setNewDeliveries((prev) => prev.filter((d) => d.localId !== localId));
  };

  const updateNewDelivery = (localId: number, field: string, value: string) =>
    setNewDeliveries((prev) => prev.map((d) => d.localId === localId ? { ...d, [field]: value } : d));

  const toggleExisting = (id: number) => {
    setSelectedExisting((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRemoveFromRoute = async (deliveryId: number) => {
    try {
      await apiFetch(`/api/deliveries/${deliveryId}`, {
        method: "PATCH",
        body: JSON.stringify({ route_id: null }),
      });
      setRouteDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
      fetchUnassigned();
    } catch { alert("Failed to remove delivery"); }
  };

  const handleAddToRoute = async (deliveryId: number) => {
    if (!editing) return;
    try {
      await apiFetch(`/api/deliveries/${deliveryId}`, {
        method: "PATCH",
        body: JSON.stringify({ route_id: editing.id }),
      });
      await fetchRouteDeliveries(editing.id);
      fetchUnassigned();
    } catch { alert("Failed to add delivery"); }
  };

  // ── Map view ───────────────────────────────────────────────────────────────

  if (view === "map" && mapRoute) {
    return (
      <RouteMapScreen
        route={mapRoute}
        deliveries={mapDeliveries}
        onBack={() => setView("list")}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-8 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Routes</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {routes.length} route{routes.length !== 1 ? "s" : ""} ·{" "}
              {tabCounts.active} active · {tabCounts.pending} pending ·{" "}
              {tabCounts.completed} completed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchRoutes} className="gap-1.5 text-gray-600">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openAdd} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
              <Plus className="h-4 w-4" />
              Add Route
            </Button>
          </div>
        </div>

        {/* Search + tabs */}
        {!loading && !error && (
          <div className="px-8 pt-5 pb-4 space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, location or driver…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
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
                  {tabCounts[tab.key] > 0 && (
                    <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-white/70" : "text-gray-400"}`}>
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* States */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading routes…</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm font-medium text-red-600">Failed to load routes</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchRoutes}>Try again</Button>
          </div>

        ) : routes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Route className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No routes yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Create your first route to start assigning drivers and deliveries.
                </p>
              </div>
              <Button onClick={openAdd} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="h-4 w-4" />
                Add your first route
              </Button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No routes found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : (
          <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((route) => (
              <div
                key={route.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Card header */}
                <div className="p-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Route className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate leading-tight">{route.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {route.start_location || "No start location"}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[route.status] ?? "bg-gray-100 text-gray-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[route.status] ?? "bg-gray-400"}`} />
                    {STATUS_LABEL[route.status] ?? route.status}
                  </span>
                </div>

                {/* Card details */}
                <div className="border-t px-5 py-4 space-y-2.5 text-sm text-gray-600">
                  {/* Stops */}
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>
                      {route.delivery_count} stop{route.delivery_count !== 1 ? "s" : ""}
                      {route.end_location ? ` · ${route.end_location}` : ""}
                    </span>
                  </div>

                  {/* Distance + duration */}
                  {(route.total_distance || route.estimated_duration) && (
                    <div className="flex items-center gap-4">
                      {route.total_distance != null && (
                        <div className="flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{route.total_distance.toFixed(1)} km</span>
                        </div>
                      )}
                      {route.estimated_duration != null && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{formatDuration(route.estimated_duration)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Driver */}
                  <div className="flex items-center gap-2.5">
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {route.driver
                      ? <span>Assigned to: <span className="font-semibold text-gray-800">{route.driver.name}</span></span>
                      : <span className="text-gray-400 italic">No driver assigned</span>
                    }
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t grid grid-cols-3 gap-2 p-3 mt-auto">
                  <button
                    onClick={() => handleViewMap(route)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Map className="h-3.5 w-3.5" />
                    Map
                  </button>
                  <button
                    onClick={() => openEdit(route)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 py-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(route)}
                    disabled={deletingId === route.id}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? `Edit Route — ${editing.name}` : "Add Route"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editing ? "Update route details and manage deliveries." : "Create a new delivery route."}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1">
              {editing ? (
                // ── Edit: two-column layout ──────────────────────────────────
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-100">

                  {/* Left: route info form */}
                  <div className="px-6 py-5 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">Route Information</h4>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                        Route Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g., Westlands Morning Run"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Start Location</label>
                      <AddressSearch
                        value={form.start_location}
                        onSelect={(r) => {
                          setForm((f) => ({
                            ...f,
                            start_location: r.display_name,
                            start_lat: r.coordinates ? String(r.coordinates[0]) : f.start_lat,
                            start_lng: r.coordinates ? String(r.coordinates[1]) : f.start_lng,
                          }));
                        }}
                        placeholder="Search for starting point"
                        className="mt-1"
                        countryCode="ke"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">End Location</label>
                      <AddressSearch
                        value={form.end_location}
                        onSelect={(r) => {
                          setForm((f) => ({
                            ...f,
                            end_location: r.display_name,
                            end_lat: r.coordinates ? String(r.coordinates[0]) : f.end_lat,
                            end_lng: r.coordinates ? String(r.coordinates[1]) : f.end_lng,
                          }));
                        }}
                        placeholder="Search for ending point"
                        className="mt-1"
                        countryCode="ke"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assign Driver</label>
                        <select
                          value={form.driver_id}
                          onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                        >
                          <option value="">Unassigned</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {formError && <p className="text-xs text-red-600">{formError}</p>}

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                      <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
                        {saving ? "Saving…" : "Save Changes"}
                      </Button>
                    </div>
                  </div>

                  {/* Right: deliveries management */}
                  <div className="px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">Deliveries</h4>
                      {loadingDeliveries && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
                    </div>

                    {/* Current deliveries */}
                    <div className="border rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        On this route ({routeDeliveries.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {routeDeliveries.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">No deliveries on this route</p>
                        ) : (
                          routeDeliveries.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-900 truncate">{d.customer_name}</p>
                                <p className="text-[11px] text-gray-500 truncate">{d.location}</p>
                                <p className="text-[11px] text-gray-400">{d.item} · {d.phone}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveFromRoute(d.id)}
                                className="ml-2 p-1.5 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Unassigned deliveries to add */}
                    <div className="border rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        Unassigned deliveries ({unassigned.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {unassigned.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">No unassigned deliveries</p>
                        ) : (
                          unassigned.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-gray-900 truncate">{d.customer_name}</p>
                                <p className="text-[11px] text-gray-500 truncate">{d.location}</p>
                                <p className="text-[11px] text-gray-400">{d.item} · {d.phone}</p>
                              </div>
                              <button
                                onClick={() => handleAddToRoute(d.id)}
                                className="ml-2 p-1.5 rounded text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              ) : (
                // ── Create: single column ────────────────────────────────────
                <div className="px-6 py-5 space-y-5">

                  {/* Route info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                        Route Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g., Westlands Morning Run"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assign Driver</label>
                      <select
                        value={form.driver_id}
                        onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                      >
                        <option value="">Unassigned</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Start Location</label>
                      <AddressSearch
                        value={form.start_location}
                        onSelect={(r) => {
                          setForm((f) => ({
                            ...f,
                            start_location: r.display_name,
                            start_lat: r.coordinates ? String(r.coordinates[0]) : f.start_lat,
                            start_lng: r.coordinates ? String(r.coordinates[1]) : f.start_lng,
                          }));
                        }}
                        placeholder="Search starting point"
                        className="mt-1"
                        countryCode="ke"
                      />
                      {form.start_lat && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {parseFloat(form.start_lat).toFixed(4)}, {parseFloat(form.start_lng).toFixed(4)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">End Location</label>
                      <AddressSearch
                        value={form.end_location}
                        onSelect={(r) => {
                          setForm((f) => ({
                            ...f,
                            end_location: r.display_name,
                            end_lat: r.coordinates ? String(r.coordinates[0]) : f.end_lat,
                            end_lng: r.coordinates ? String(r.coordinates[1]) : f.end_lng,
                          }));
                        }}
                        placeholder="Search ending point"
                        className="mt-1"
                        countryCode="ke"
                      />
                      {form.end_lat && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {parseFloat(form.end_lat).toFixed(4)}, {parseFloat(form.end_lng).toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Deliveries section */}
                  <div className="border-t pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Delivery Stops</p>
                        <p className="text-xs text-gray-400">Add deliveries to this route</p>
                      </div>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("new")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          deliveryMode === "new"
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Create new deliveries
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("existing")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          deliveryMode === "existing"
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        Use existing ({unassigned.length} available)
                      </button>
                    </div>

                    {deliveryMode === "new" ? (
                      <>
                        <div className="flex justify-end mb-3">
                          <button
                            type="button"
                            onClick={addNewDelivery}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Delivery
                          </button>
                        </div>

                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {newDeliveries.map((delivery, index) => (
                            <div key={delivery.localId} className="p-4 border rounded-xl bg-gray-50 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-700">Delivery #{index + 1}</p>
                                {newDeliveries.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeNewDelivery(delivery.localId)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Customer Name *</label>
                                  <input
                                    type="text"
                                    placeholder="Jane Doe"
                                    value={delivery.customer_name}
                                    onChange={(e) => updateNewDelivery(delivery.localId, "customer_name", e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Phone *</label>
                                  <input
                                    type="text"
                                    placeholder="+254 712 345 678"
                                    value={delivery.phone}
                                    onChange={(e) => updateNewDelivery(delivery.localId, "phone", e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-xs text-gray-600 mb-1 block">Delivery Location *</label>
                                  <AddressSearch
                                    value={delivery.location}
                                    onSelect={(r) => {
                                      if (r.coordinates) {
                                        setNewDeliveries((prev) =>
                                          prev.map((d) =>
                                            d.localId === delivery.localId
                                              ? { ...d, location: r.display_name, lat: String(r.coordinates![0]), lng: String(r.coordinates![1]) }
                                              : d
                                          )
                                        );
                                      }
                                    }}
                                    placeholder="Search delivery location"
                                    className="mt-1"
                                    countryCode="ke"
                                  />
                                  {delivery.lat && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {parseFloat(delivery.lat).toFixed(4)}, {parseFloat(delivery.lng).toFixed(4)}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Item *</label>
                                  <input
                                    type="text"
                                    placeholder="What to deliver"
                                    value={delivery.item}
                                    onChange={(e) => updateNewDelivery(delivery.localId, "item", e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Drop Time *</label>
                                  <input
                                    type="time"
                                    value={delivery.drop_time}
                                    onChange={(e) => updateNewDelivery(delivery.localId, "drop_time", e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Estimated Value</label>
                                  <input
                                    type="text"
                                    placeholder="KSh 2,500"
                                    value={delivery.estimated_value}
                                    onChange={(e) => updateNewDelivery(delivery.localId, "estimated_value", e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">Notes</label>
                                  <input
                                    type="text"
                                    placeholder="Special instructions"
                                    value={delivery.delivery_notes}
                                    onChange={(e) => updateNewDelivery(delivery.localId, "delivery_notes", e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      // Existing deliveries list
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {unassigned.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <p className="text-sm">No unassigned deliveries available</p>
                            <p className="text-xs mt-1">Switch to "Create new deliveries" to add some</p>
                          </div>
                        ) : (
                          unassigned.map((d) => (
                            <div
                              key={d.id}
                              onClick={() => toggleExisting(d.id)}
                              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedExisting.has(d.id)
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedExisting.has(d.id)}
                                onChange={() => toggleExisting(d.id)}
                                className="accent-emerald-700 h-4 w-4 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{d.customer_name}</p>
                                <p className="text-xs text-gray-500 truncate">{d.location}</p>
                                <p className="text-xs text-gray-400">{d.item} · {d.phone}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    Driver assignment changes the driver's status automatically.
                  </div>

                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                </div>
              )}
            </div>

            {/* Modal footer (create mode) */}
            {!editing && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0">
                <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
                  {saving ? "Creating…" : "Create Route"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
