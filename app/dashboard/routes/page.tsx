"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus, Pencil, Search, X, MapPin, Clock,
  RefreshCw, AlertCircle, CheckCircle2, ChevronRight,
  ClipboardList, Eye, Package, CheckCircle, Archive,
  Route as RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AddressSearch from "@/components/address-search";
import RouteMapScreen from "@/app/screens/route-map-screen";
import MapComponent from "@/components/map-component";
import { supabase, parsePointCoordinates } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type AcceptedRequest = {
  id: number;
  business_name: string;
  drivers_requested: number;
  allocated_count: number;
  start_date: string;
  end_date: string | null;
  status: string;
  allocated_driver_ids: number[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "at_capacity", label: "At Capacity" },
  { key: "archived", label: "Archived" },
];

const MODE_TABS = [
  { key: "all", label: "All Modes" },
  { key: "allocation", label: "Allocation" },
  { key: "managed", label: "Managed" },
];

const EMPTY_FORM: FormState = {
  name: "", start_location: "", start_lat: "", start_lng: "",
  end_location: "", end_lat: "", end_lng: "", driver_id: "", status: "pending",
};

const newDeliveryForm = (): DeliveryForm => ({
  localId: Date.now() + Math.random(),
  customer_name: "", location: "", lat: "", lng: "", item: "",
  phone: "", drop_time: "", estimated_value: "", weight: "", delivery_notes: "",
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

function getStatusDisplay(status: RouteStatus) {
  if (status === "active")
    return { label: "Active", dotColor: "#10B981", bgColor: "#ECFDF5", textColor: "#065F46", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" };
  if (status === "pending")
    return { label: "Active", dotColor: "#10B981", bgColor: "#ECFDF5", textColor: "#065F46", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" };
  return { label: "Archived", dotColor: "#9CA3AF", bgColor: "#F3F4F6", textColor: "#6B7280", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-500" };
}

function getDeliveryStatusBadge(status: string) {
  if (status === "completed")
    return { label: "DELIVERED", cls: "bg-emerald-50 text-emerald-700" };
  if (status === "in-progress")
    return { label: "EN ROUTE", cls: "bg-blue-50 text-blue-700" };
  return { label: "PENDING", cls: "bg-gray-100 text-gray-500" };
}

function routeIdLabel(id: number) {
  return `RT-${String(id).padStart(3, "0")}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const [view, setView]                     = useState<"list" | "map">("list");
  const [mapRoute, setMapRoute]             = useState<any>(null);
  const [mapDeliveries, setMapDeliveries]   = useState<any[]>([]);

  const [routes, setRoutes]                 = useState<PartnerRoute[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [drivers, setDrivers]               = useState<any[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<AcceptedRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<number>>(new Set());

  const [activeTab, setActiveTab]           = useState("all");
  const [modeTab, setModeTab]               = useState("all");
  const [search, setSearch]                 = useState("");

  // View panel
  const [viewOpen, setViewOpen]             = useState(false);
  const [viewRoute, setViewRoute]           = useState<PartnerRoute | null>(null);
  const [viewDeliveries, setViewDeliveries] = useState<Delivery[]>([]);
  const [loadingViewDeliveries, setLoadingViewDeliveries] = useState(false);

  // Create/Edit modal
  const [modalOpen, setModalOpen]           = useState(false);
  const [editing, setEditing]               = useState<PartnerRoute | null>(null);
  const [form, setForm]                     = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]                 = useState(false);
  const [formError, setFormError]           = useState<string | null>(null);
  const [deletingId, setDeletingId]         = useState<number | null>(null);

  const [deliveryMode, setDeliveryMode]     = useState<"new" | "existing">("new");
  const [newDeliveries, setNewDeliveries]   = useState<DeliveryForm[]>([newDeliveryForm()]);
  const [unassigned, setUnassigned]         = useState<Delivery[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<Set<number>>(new Set());
  const [routeDeliveries, setRouteDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Wizard state (create mode only)
  const [wizardStep, setWizardStep]       = useState(1);
  const [wizardType, setWizardType]       = useState<"allocation" | "managed">("allocation");
  const [wizardName, setWizardName]       = useState("");
  const [wizardArea, setWizardArea]       = useState("");
  const [wizardDays, setWizardDays]       = useState<string[]>(["Mon","Tue","Wed","Thu","Fri"]);
  const [wizardStartTime, setWizardStartTime] = useState("08:00");
  const [wizardEndTime, setWizardEndTime]   = useState("18:00");
  const [wizardMinDel, setWizardMinDel]   = useState("");
  const [wizardMaxDel, setWizardMaxDel]   = useState("");
  const [wizardDriverCap, setWizardDriverCap] = useState("");
  const [wizardMaxOrders, setWizardMaxOrders] = useState("");
  const [wizardCutoff, setWizardCutoff]   = useState("20:00");
  const [wizardRequestsTab, setWizardRequestsTab] = useState<"ondemand" | "business">("ondemand");

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

  const fetchAcceptedRequests = async () => {
    try {
      const data: any[] = await apiFetch("/api/requests");
      const active = (Array.isArray(data) ? data : []).filter((r: any) =>
        ["accepted", "partially_allocated", "fully_allocated"].includes(r.status)
      );
      const enriched: AcceptedRequest[] = await Promise.all(
        active.map(async (r: any) => {
          try {
            const allocs: any[] = await apiFetch(`/api/requests/${r.id}/allocations`);
            const driverIds = (Array.isArray(allocs) ? allocs : [])
              .filter((a: any) => a.status !== "cancelled")
              .map((a: any) => a.driver_id);
            return { ...r, allocated_driver_ids: driverIds };
          } catch {
            return { ...r, allocated_driver_ids: [] };
          }
        })
      );
      setAcceptedRequests(enriched);
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
    let list = routes;
    if (activeTab === "active")      list = list.filter((r) => r.status === "active");
    else if (activeTab === "at_capacity") list = list.filter((r) => r.status === "pending");
    else if (activeTab === "archived")    list = list.filter((r) => ["completed", "cancelled"].includes(r.status));
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

  const tabCounts = useMemo(() => ({
    all: routes.length,
    active: routes.filter((r) => r.status === "active").length,
    at_capacity: routes.filter((r) => r.status === "pending").length,
    archived: routes.filter((r) => ["completed", "cancelled"].includes(r.status)).length,
  }), [routes]);

  // ── View panel ─────────────────────────────────────────────────────────────

  const handleView = async (route: PartnerRoute) => {
    setViewRoute(route);
    setViewOpen(true);
    setLoadingViewDeliveries(true);
    setViewDeliveries([]);
    try {
      const data = await apiFetch(`/api/deliveries?route_id=${route.id}`);
      setViewDeliveries(Array.isArray(data) ? data : []);
    } catch { /* non-blocking */ }
    finally { setLoadingViewDeliveries(false); }
  };

  const handleViewFullDetails = async () => {
    if (!viewRoute) return;
    setViewOpen(false);
    await handleViewMap(viewRoute);
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setNewDeliveries([newDeliveryForm()]);
    setDeliveryMode("new");
    setSelectedExisting(new Set());
    setSelectedRequestIds(new Set());
    setRouteDeliveries([]);
    // Reset wizard
    setWizardStep(1);
    setWizardType("allocation");
    setWizardName("");
    setWizardArea("");
    setWizardDays(["Mon","Tue","Wed","Thu","Fri"]);
    setWizardStartTime("08:00");
    setWizardEndTime("18:00");
    setWizardMinDel("");
    setWizardMaxDel("");
    setWizardDriverCap("");
    setWizardMaxOrders("");
    setWizardCutoff("20:00");
    setWizardRequestsTab("ondemand");
    fetchUnassigned();
    fetchAcceptedRequests();
    setModalOpen(true);
  };

  const openEdit = async (route: PartnerRoute) => {
    setEditing(route);
    setForm({
      name: route.name,
      start_location: route.start_location ?? "",
      start_lat: "", start_lng: "",
      end_location: route.end_location ?? "",
      end_lat: "", end_lng: "",
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

  const handleSave = async (nameOverride?: string) => {
    const routeName = nameOverride ?? form.name;
    if (!routeName.trim()) { setFormError("Route name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        name: routeName.trim(),
        start_location: form.start_location || null,
        end_location: form.end_location || null,
        driver_id: form.driver_id ? parseInt(form.driver_id) : null,
        status: form.status,
        lat: form.start_lat || "0",
        lng: form.start_lng || "0",
        ...(!editing && {
          route_type: wizardType,
          service_area: wizardArea || null,
          active_days: wizardDays,
          start_time: wizardStartTime,
          end_time: wizardEndTime,
          min_deliveries: parseInt(wizardMinDel) || 0,
          max_deliveries: wizardMaxDel ? parseInt(wizardMaxDel) : null,
          driver_capacity: wizardType === "allocation" && wizardDriverCap ? parseInt(wizardDriverCap) : null,
          max_orders: wizardType === "managed" && wizardMaxOrders ? parseInt(wizardMaxOrders) : null,
          cutoff_time: wizardType === "managed" && wizardCutoff ? wizardCutoff : null,
        }),
      };

      if (editing) {
        const updated = await apiFetch(`/api/routes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setRoutes((prev) =>
          prev.map((r) => r.id === updated.id
            ? { ...updated, driver: r.driver, delivery_count: r.delivery_count }
            : r
          )
        );
        setModalOpen(false);
      } else {
        const created = await apiFetch("/api/routes", { method: "POST", body: JSON.stringify(payload) });
        if (deliveryMode === "new") {
          const valid = newDeliveries.filter(
            (d) => d.customer_name && d.location && d.lat && d.lng && d.phone && d.item && d.drop_time
          );
          for (let i = 0; i < valid.length; i++) {
            const d = valid[i];
            await apiFetch("/api/deliveries", {
              method: "POST",
              body: JSON.stringify({
                customer_name: d.customer_name, location: d.location,
                coordinates: [parseFloat(d.lat), parseFloat(d.lng)],
                item: d.item, phone: d.phone, drop_time: d.drop_time,
                estimated_value: d.estimated_value || null, weight: d.weight || null,
                delivery_notes: d.delivery_notes || null,
                route_id: created.id, order_index: i, status: "pending",
              }),
            });
          }
        } else {
          for (const deliveryId of Array.from(selectedExisting)) {
            await apiFetch(`/api/deliveries/${deliveryId}`, {
              method: "PATCH", body: JSON.stringify({ route_id: created.id }),
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

  // ── Delete / Archive ───────────────────────────────────────────────────────

  const handleDelete = async (route: PartnerRoute) => {
    if (!confirm(`Archive route "${route.name}"? All linked deliveries will be unassigned.`)) return;
    setDeletingId(route.id);
    try {
      await apiFetch(`/api/routes/${route.id}`, { method: "DELETE" });
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
      if (viewRoute?.id === route.id) setViewOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive route");
    } finally {
      setDeletingId(null);
    }
  };

  // ── View map ───────────────────────────────────────────────────────────────

  const handleViewMap = async (route: PartnerRoute) => {
    try {
      const deliveriesData: Delivery[] = await apiFetch(`/api/deliveries?route_id=${route.id}`);
      const formatted = deliveriesData.map((d) => ({
        id: d.id, customer_name: d.customer_name, location: d.location,
        coordinates: parsePointCoordinates(d.coordinates) as [number, number],
        item: d.item, estimated_value: d.estimated_value, weight: d.weight,
        phone: d.phone, drop_time: d.drop_time,
        status: d.status as "pending" | "in-progress" | "completed" | "failed",
      }));
      setMapRoute({
        id: route.id, name: route.name,
        distance: route.total_distance ? `${route.total_distance.toFixed(1)} km` : "0.0 km",
        duration: route.estimated_duration ? formatDuration(route.estimated_duration) : "0m",
        stops: formatted.length, status: route.status,
        driver: route.driver
          ? { id: route.driver.id, name: route.driver.name, phone: "", vehicle_type: "" }
          : null,
        lastUpdated: new Date(route.updated_at).toLocaleDateString(),
        efficiency: route.efficiency_score || 0,
        start_location: route.start_location,
        end_location: route.end_location,
      });
      setMapDeliveries(formatted);
      setView("map");
    } catch {
      alert("Failed to load route deliveries");
    }
  };

  // ── Delivery form helpers ──────────────────────────────────────────────────

  const addNewDelivery = () => setNewDeliveries((prev) => [...prev, newDeliveryForm()]);

  const removeNewDelivery = (localId: number) => {
    if (newDeliveries.length > 1)
      setNewDeliveries((prev) => prev.filter((d) => d.localId !== localId));
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
        method: "PATCH", body: JSON.stringify({ route_id: null }),
      });
      setRouteDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
      fetchUnassigned();
    } catch { alert("Failed to remove delivery"); }
  };

  const handleAddToRoute = async (deliveryId: number) => {
    if (!editing) return;
    try {
      await apiFetch(`/api/deliveries/${deliveryId}`, {
        method: "PATCH", body: JSON.stringify({ route_id: editing.id }),
      });
      await fetchRouteDeliveries(editing.id);
      fetchUnassigned();
    } catch { alert("Failed to add delivery"); }
  };

  // ── Map full-screen view ───────────────────────────────────────────────────

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
      <div className="flex flex-col h-full overflow-auto">

        {/* Page Header */}
        <div style={{ padding: "32px 24px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: 28, fontWeight: 600, color: "#1F2937" }}>
              Routes & Zones
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>
              {routes.length} routes configured
            </p>
          </div>
          <button
            onClick={openAdd}
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
            Create Route
          </button>
        </div>

        {/* Toolbar */}
        {!loading && !error && (
          <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 8 }}>
              <Search className="h-4 w-4 shrink-0" style={{ color: "#B0B0B0" }} />
              <input
                placeholder="Search routes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#1F2937", backgroundColor: "transparent" }}
              />
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {/* Status group */}
              <div style={{ display: "flex", gap: 8, backgroundColor: "#F9FAFB", padding: 4, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                {STATUS_TABS.map(({ key, label }) => (
                  <span
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
                      backgroundColor: activeTab === key ? "#FFFFFF" : "transparent",
                      color: activeTab === key ? "#0F6D48" : "#6B7280",
                      border: activeTab === key ? "1px solid #E5E7EB" : "1px solid transparent",
                      boxShadow: activeTab === key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Mode group */}
              <div style={{ display: "flex", gap: 8, backgroundColor: "#F9FAFB", padding: 4, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                {MODE_TABS.map(({ key, label }) => (
                  <span
                    key={key}
                    onClick={() => setModeTab(key)}
                    style={{
                      padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
                      backgroundColor: modeTab === key ? "#FFFFFF" : "transparent",
                      color: modeTab === key ? "#0F6D48" : "#6B7280",
                      border: modeTab === key ? "1px solid #E5E7EB" : "1px solid transparent",
                      boxShadow: modeTab === key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
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
            <button onClick={fetchRoutes} style={{ padding: "8px 16px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 13, cursor: "pointer", backgroundColor: "#fff" }}>Try again</button>
          </div>

        ) : (
          <>
            {/* Routes Grid */}
            {filtered.length > 0 && (
              <div
                style={{
                  padding: "0 24px 24px",
                  display: "grid",
                  gridTemplateColumns: viewOpen ? "repeat(auto-fill, minmax(340px, 1fr))" : "repeat(auto-fill, minmax(380px, 1fr))",
                  gap: 20,
                }}
              >
                {filtered.map((route, i) => {
                  const statusDisplay = getStatusDisplay(route.status);
                  const isViewing = viewRoute?.id === route.id && viewOpen;

                  return (
                    <div
                      key={route.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: isViewing ? "1.5px solid #0F6D48" : "1px solid #E5E7EB",
                        borderRadius: 12,
                        overflow: "hidden",
                        animation: "fadeInUp 0.4s ease forwards",
                        animationDelay: `${i * 40}ms`,
                        opacity: 0,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ padding: "20px 24px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 4 }}>{route.name}</div>
                          <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>{routeIdLabel(route.id)}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          {/* Status pill */}
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                            backgroundColor: statusDisplay.bgColor, color: statusDisplay.textColor,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusDisplay.dotColor, display: "inline-block" }} />
                            {statusDisplay.label}
                          </span>
                          {/* Mode badge */}
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, backgroundColor: "#EEF2FF", color: "#4338CA" }}>
                            Allocation
                          </span>
                        </div>
                      </div>

                      {/* Card Info */}
                      <div style={{ padding: "20px 24px" }}>
                        {route.start_location && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginBottom: 10 }}>
                            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />
                            {route.start_location}
                          </div>
                        )}
                        {route.end_location && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginBottom: 10 }}>
                            <ClipboardList className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />
                            {route.end_location}
                          </div>
                        )}
                        {(route.total_distance || route.estimated_duration) && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                            <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />
                            {[
                              route.total_distance ? `${route.total_distance.toFixed(1)} km` : null,
                              route.estimated_duration ? formatDuration(route.estimated_duration) : null,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {!route.start_location && !route.end_location && !route.total_distance && !route.estimated_duration && (
                          <div style={{ fontSize: 13, color: "#9CA3AF" }}>No location info</div>
                        )}
                      </div>

                      {/* Card Stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
                        <div style={{ padding: 16, textAlign: "center", borderRight: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Max Drivers</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2937" }}>{route.delivery_count || "—"}</div>
                        </div>
                        <div style={{ padding: 16, textAlign: "center", borderRight: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Assigned</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2937" }}>{route.driver ? 1 : 0}</div>
                        </div>
                        <div style={{ padding: 16, textAlign: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Available</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2937" }}>{route.driver ? 0 : route.delivery_count}</div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div style={{ padding: "16px 24px", display: "flex", gap: 12 }}>
                        <button
                          onClick={() => handleView(route)}
                          style={{
                            flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600,
                            color: isViewing ? "#0F6D48" : "#374151",
                            backgroundColor: isViewing ? "#F0FDF4" : "#FFFFFF",
                            border: isViewing ? "1px solid #0F6D48" : "1px solid #E5E7EB",
                            borderRadius: 6, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { if (!isViewing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9FAFB"; }}
                          onMouseLeave={(e) => { if (!isViewing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFFFFF"; }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          onClick={() => openEdit(route)}
                          style={{
                            flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600,
                            color: "#0F6D48", backgroundColor: "#F0FDF4",
                            border: "1px solid #0F6D48",
                            borderRadius: 6, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E8F5ED")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F0FDF4")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: "80px 24px", textAlign: "center" }}>
                <RouteIcon className="h-10 w-10 mx-auto mb-4" style={{ color: "#D1D5DB" }} />
                <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600, color: "#1F2937" }}>
                  {routes.length === 0 ? "No routes yet" : "No routes found"}
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>
                  {routes.length === 0
                    ? "Create your first route to start assigning drivers and deliveries."
                    : "Try adjusting your search or filters"}
                </p>
                {routes.length === 0 && (
                  <button
                    onClick={openAdd}
                    style={{
                      marginTop: 20, padding: "10px 20px", fontSize: 14, fontWeight: 600,
                      color: "#162318", backgroundColor: "#CDF782", border: "none",
                      borderRadius: 8, cursor: "pointer",
                    }}
                  >
                    Add your first route
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── View Panel backdrop ─────────────────────────────────────────────────── */}
      {viewOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setViewOpen(false)}
        />
      )}

      {/* ── View Panel ─────────────────────────────────────────────────────────── */}
      {viewOpen && viewRoute && (
        <div style={{ position: "fixed", right: 0, top: 0, height: "100%", width: 500, backgroundColor: "#fff", borderLeft: "1px solid #E5E7EB", boxShadow: "-8px 0 32px rgba(0,0,0,0.18)", zIndex: 40, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Panel header */}
          <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                  {viewRoute.name}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>
                  {routeIdLabel(viewRoute.id)}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  {(() => {
                    const s = getStatusDisplay(viewRoute.status);
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, backgroundColor: s.bgColor, color: s.textColor }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: s.dotColor, display: "inline-block" }} />
                        {s.label}
                      </span>
                    );
                  })()}
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, backgroundColor: "#EEF2FF", color: "#4338CA" }}>
                    Allocation
                  </span>
                </div>
              </div>
              <button onClick={() => setViewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9CA3AF", marginTop: 2 }}>
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Live Tracking map */}
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Live Tracking
                </p>
{(() => {
                  const activeCount = viewDeliveries.filter(
                    (d) => d.status === "pending" || d.status === "in-progress"
                  ).length;
                  return activeCount > 0 ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 600, color: "#059669",
                      backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0",
                      padding: "4px 10px", borderRadius: 999,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block", flexShrink: 0 }} />
                      {activeCount} deliveries active
                    </span>
                  ) : loadingViewDeliveries ? null : (
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>No active deliveries</span>
                  );
                })()}
              </div>
              <div style={{ borderRadius: 12, overflow: "hidden", height: 180, backgroundColor: "#F3F4F6" }}>
                {loadingViewDeliveries ? (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontSize: 12, color: "#9CA3AF" }}>Loading map…</p>
                  </div>
                ) : viewDeliveries.length > 0 ? (
                  <MapComponent
                    deliveries={viewDeliveries.map((d) => ({
                      ...d,
                      coordinates: parsePointCoordinates(d.coordinates) as [number, number],
                      status: d.status as "pending" | "in-progress" | "completed" | "failed",
                    }))}
                    selectedDelivery={null}
                    onDeliverySelect={() => {}}
                    routeId={viewRoute.id}
                  />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontSize: 12, color: "#9CA3AF" }}>No stops to display</p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Progress */}
            {!loadingViewDeliveries && viewDeliveries.length > 0 && (() => {
              const completed  = viewDeliveries.filter((d) => d.status === "completed").length;
              const inProgress = viewDeliveries.filter((d) => d.status === "in-progress").length;
              const pending    = viewDeliveries.filter((d) => d.status === "pending").length;
              return (
                <div style={{ padding: "20px 24px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Delivery Progress
                    </p>
                    <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
                      {completed}/{viewDeliveries.length} completed
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div style={{ backgroundColor: "#ECFDF5", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#065F46" }}>{completed}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.04em" }}>Completed</p>
                    </div>
                    <div style={{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1D4ED8" }}>{inProgress}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.04em" }}>In Progress</p>
                    </div>
                    <div style={{ padding: "12px 8px", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#374151" }}>{pending}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pending</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Delivery Stops */}
            <div style={{ padding: "20px 24px 24px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Delivery Stops ({viewDeliveries.length})
              </p>

              {loadingViewDeliveries ? (
                <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "24px 0" }}>Loading stops…</p>
              ) : viewDeliveries.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "24px 0" }}>No stops on this route</p>
              ) : (
                <div>
                  {viewDeliveries.map((d, index) => {
                    const badge = getDeliveryStatusBadge(d.status);
                    const isCompleted = d.status === "completed";
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
                        {/* Circle indicator */}
                        {isCompleted ? (
                          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            <CheckCircle className="h-4 w-4" style={{ color: "#fff" }} />
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#111827", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                        )}

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {d.customer_name}
                            </p>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, flexShrink: 0,
                              ...(d.status === "completed"
                                ? { backgroundColor: "#ECFDF5", color: "#065F46" }
                                : d.status === "in-progress"
                                ? { backgroundColor: "#EFF6FF", color: "#1D4ED8" }
                                : { backgroundColor: "#F3F4F6", color: "#6B7280" })
                            }}>
                              {badge.label}
                            </span>
                          </div>
                          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.location}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                            {d.drop_time && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
                                <Clock className="h-3 w-3" />
                                {d.drop_time}
                              </span>
                            )}
                            {d.item && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9CA3AF" }}>
                                <Package className="h-3 w-3" />
                                {d.item}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panel footer */}
          <div style={{ borderTop: "1px solid #E5E7EB", padding: 16, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, backgroundColor: "#fff" }}>
            <button
              onClick={handleViewFullDetails}
              style={{ width: "100%", padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#fff", backgroundColor: "#14532D", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#166534")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#14532D")}
            >
              <Eye className="h-4 w-4" />
              View Full Details
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => { setViewOpen(false); openEdit(viewRoute); }}
                style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#374151", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9FAFB")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fff")}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                disabled={deletingId === viewRoute.id}
                onClick={() => handleDelete(viewRoute)}
                style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#DC2626", backgroundColor: "#fff", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FEF2F2")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fff")}
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? `Edit Route — ${editing.name}` : "Create Route"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editing ? "Update route details and manage deliveries." : "Create a new delivery route."}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {editing ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-100">

                  {/* Left: route info */}
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
                        onSelect={(r) => setForm((f) => ({
                          ...f, start_location: r.display_name,
                          start_lat: r.coordinates ? String(r.coordinates[0]) : f.start_lat,
                          start_lng: r.coordinates ? String(r.coordinates[1]) : f.start_lng,
                        }))}
                        placeholder="Search for starting point"
                        className="mt-1"
                        countryCode="ke"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">End Location</label>
                      <AddressSearch
                        value={form.end_location}
                        onSelect={(r) => setForm((f) => ({
                          ...f, end_location: r.display_name,
                          end_lat: r.coordinates ? String(r.coordinates[0]) : f.end_lat,
                          end_lng: r.coordinates ? String(r.coordinates[1]) : f.end_lng,
                        }))}
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
                      <Button onClick={() => handleSave()} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
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
                    <div className="border rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        On this route ({routeDeliveries.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {routeDeliveries.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">No deliveries on this route</p>
                        ) : routeDeliveries.map((d) => (
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
                        ))}
                      </div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        Unassigned deliveries ({unassigned.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {unassigned.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">No unassigned deliveries</p>
                        ) : unassigned.map((d) => (
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
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              ) : (
                /* ── Create Wizard ── */
                (() => {
                  const STEPS = ["TYPE","INFO","CAPACITY","REQUESTS"];
                  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

                  const StepCircle = ({ n }: { n: number }) => {
                    const done = wizardStep > n;
                    const active = wizardStep === n;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          backgroundColor: done ? "#10B981" : "transparent",
                          border: done ? "none" : active ? "2px solid #10B981" : "2px solid #D1D5DB",
                        }}>
                          {done
                            ? <CheckCircle className="h-4 w-4" style={{ color: "#fff" }} />
                            : <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#10B981" : "#9CA3AF" }}>{n}</span>
                          }
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#10B981" : done ? "#10B981" : "#9CA3AF", letterSpacing: "0.05em" }}>{STEPS[n-1]}</span>
                      </div>
                    );
                  };

                  return (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      {/* Step progress */}
                      <div style={{ padding: "20px 32px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0 }}>
                        {[1,2,3,4].map((n) => (
                          <div key={n} style={{ display: "flex", alignItems: "flex-start" }}>
                            <StepCircle n={n} />
                            {n < 4 && (
                              <div style={{ width: 64, height: 2, backgroundColor: wizardStep > n ? "#10B981" : "#E5E7EB", marginTop: 15, marginLeft: 0, marginRight: 0 }} />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Step content */}
                      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>

                        {/* STEP 1: TYPE */}
                        {wizardStep === 1 && (
                          <div>
                            <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Choose Route Type</p>
                            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6B7280" }}>Select how this route will be managed</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                              {(["allocation","managed"] as const).map((type) => {
                                const selected = wizardType === type;
                                const title = type === "allocation" ? "Allocation" : "Managed Delivery";
                                const sub   = type === "allocation" ? "Drivers assigned directly to your clients" : "You manage the full delivery fulfillment";
                                const perks = type === "allocation"
                                  ? ["Best for recurring clients","Simple driver assignment","Client-controlled dispatch"]
                                  : ["Full delivery control","Route optimization","Real-time tracking"];
                                return (
                                  <div
                                    key={type}
                                    onClick={() => setWizardType(type)}
                                    style={{
                                      border: selected ? "2px solid #10B981" : "2px solid #E5E7EB",
                                      borderRadius: 12, padding: 20, cursor: "pointer",
                                      backgroundColor: selected ? "#F0FDF4" : "#fff",
                                      position: "relative", transition: "all 0.15s",
                                    }}
                                  >
                                    {selected && (
                                      <div style={{ position: "absolute", top: 12, right: 12, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <CheckCircle className="h-3 w-3" style={{ color: "#fff" }} />
                                      </div>
                                    )}
                                    <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: selected ? "#DCFCE7" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                                      {type === "allocation"
                                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selected ? "#059669" : "#6B7280"} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selected ? "#059669" : "#6B7280"} strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                                      }
                                    </div>
                                    <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</p>
                                    <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6B7280" }}>{sub}</p>
                                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                                      {perks.map((p) => (
                                        <li key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                                          <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#10B981", flexShrink: 0 }} />
                                          {p}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* STEP 2: INFO */}
                        {wizardStep === 2 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div>
                              <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Route Information</p>
                              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Basic details for this route</p>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Route Name <span style={{ color: "#EF4444" }}>*</span></label>
                              <input
                                type="text"
                                value={wizardName}
                                onChange={(e) => setWizardName(e.target.value)}
                                placeholder="e.g., Westlands Morning Run"
                                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9CA3AF" }}>Give this route a descriptive name</p>
                            </div>
                            <div>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                                Service Area
                                <span title="Comma-separated areas this route covers" style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#E5E7EB", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6B7280", cursor: "default" }}>i</span>
                              </label>
                              <input
                                type="text"
                                value={wizardArea}
                                onChange={(e) => setWizardArea(e.target.value)}
                                placeholder="e.g., Westlands, Parklands, Lavington"
                                style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                              />
                              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9CA3AF" }}>Comma-separated areas</p>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Active Days</label>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {DAYS.map((d) => {
                                  const on = wizardDays.includes(d);
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => setWizardDays((prev) => on ? prev.filter((x) => x !== d) : [...prev, d])}
                                      style={{
                                        padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                                        border: on ? "2px solid #10B981" : "2px solid #E5E7EB",
                                        backgroundColor: on ? "#F0FDF4" : "#fff",
                                        color: on ? "#059669" : "#6B7280",
                                        transition: "all 0.12s",
                                      }}
                                    >{d}</button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 3: CAPACITY */}
                        {wizardStep === 3 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div>
                              <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Capacity Settings</p>
                              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Set time windows and delivery limits</p>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                              <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Start Time</label>
                                <input type="time" value={wizardStartTime} onChange={(e) => setWizardStartTime(e.target.value)}
                                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>End Time</label>
                                <input type="time" value={wizardEndTime} onChange={(e) => setWizardEndTime(e.target.value)}
                                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Min Deliveries / Day</label>
                                <input type="number" min="0" value={wizardMinDel} onChange={(e) => setWizardMinDel(e.target.value)}
                                  placeholder="0"
                                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Max Deliveries / Day</label>
                                <input type="number" min="0" value={wizardMaxDel} onChange={(e) => setWizardMaxDel(e.target.value)}
                                  placeholder="50"
                                  style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                              </div>
                            </div>
                            {/* Configuration block */}
                            <div style={{ borderLeft: "4px solid #10B981", paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
                              <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#065F46" }}>
                                {wizardType === "allocation" ? "Allocation Configuration" : "Managed Delivery Configuration"}
                              </p>
                              {wizardType === "allocation" ? (
                                <div>
                                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Driver Capacity</label>
                                  <input type="number" min="1" value={wizardDriverCap} onChange={(e) => setWizardDriverCap(e.target.value)}
                                    placeholder="5"
                                    style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9CA3AF" }}>Max drivers assigned to this route at once</p>
                                </div>
                              ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                  <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Max Orders</label>
                                    <input type="number" min="1" value={wizardMaxOrders} onChange={(e) => setWizardMaxOrders(e.target.value)}
                                      placeholder="100"
                                      style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                  </div>
                                  <div>
                                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Order Cutoff Time</label>
                                    <input type="time" value={wizardCutoff} onChange={(e) => setWizardCutoff(e.target.value)}
                                      style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* STEP 4: REQUESTS */}
                        {wizardStep === 4 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                              <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Attach Requests</p>
                              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Link delivery requests to this route</p>
                            </div>
                            {/* Tabs */}
                            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #F3F4F6" }}>
                              {(["ondemand","business"] as const).map((tab) => {
                                const label = tab === "ondemand" ? "On-Demand Requests" : "Business Deliveries";
                                const active = wizardRequestsTab === tab;
                                return (
                                  <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setWizardRequestsTab(tab)}
                                    style={{
                                      padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                                      border: "none", background: "none",
                                      color: active ? "#059669" : "#9CA3AF",
                                      borderBottom: active ? "2px solid #10B981" : "2px solid transparent",
                                      marginBottom: -2, transition: "all 0.12s",
                                    }}
                                  >{label}</button>
                                );
                              })}
                            </div>
                            {wizardRequestsTab === "ondemand" ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {acceptedRequests.length === 0 ? (
                                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
                                    <ClipboardList className="h-8 w-8 mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                                    <p style={{ fontSize: 13, margin: 0 }}>No approved requests available</p>
                                  </div>
                                ) : acceptedRequests.map((req) => {
                                  const checked = selectedRequestIds.has(req.id);
                                  const timeAgo = (() => {
                                    const diff = Date.now() - new Date(req.start_date).getTime();
                                    const days = Math.floor(diff / 86400000);
                                    return days === 0 ? "Today" : `${days}d ago`;
                                  })();
                                  return (
                                    <div
                                      key={req.id}
                                      onClick={() => setSelectedRequestIds((prev) => {
                                        const next = new Set(prev);
                                        next.has(req.id) ? next.delete(req.id) : next.add(req.id);
                                        return next;
                                      })}
                                      style={{
                                        border: checked ? "2px solid #10B981" : "1px solid #E5E7EB",
                                        borderRadius: 10, padding: 14, cursor: "pointer",
                                        backgroundColor: checked ? "#F0FDF4" : "#fff",
                                        transition: "all 0.12s",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>{req.business_name}</p>
                                        <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{timeAgo}</span>
                                      </div>
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                        <div style={{ backgroundColor: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
                                          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>PICKUP</p>
                                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#374151" }}>{req.allocated_count} drivers</p>
                                        </div>
                                        <div style={{ backgroundColor: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
                                          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>DROPOFF</p>
                                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#374151" }}>{req.drivers_requested} needed</p>
                                        </div>
                                        <div style={{ backgroundColor: "#F9FAFB", borderRadius: 8, padding: "8px 10px" }}>
                                          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>VALUE</p>
                                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#374151" }}>KES —</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {unassigned.length === 0 ? (
                                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
                                    <Package className="h-8 w-8 mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                                    <p style={{ fontSize: 13, margin: 0 }}>No business deliveries available</p>
                                  </div>
                                ) : unassigned.map((d) => {
                                  const sel = selectedExisting.has(d.id);
                                  return (
                                    <div
                                      key={d.id}
                                      onClick={() => toggleExisting(d.id)}
                                      style={{
                                        border: sel ? "2px solid #10B981" : "1px solid #E5E7EB",
                                        borderRadius: 10, padding: 14, cursor: "pointer",
                                        backgroundColor: sel ? "#F0FDF4" : "#fff",
                                        transition: "all 0.12s",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <div>
                                          <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "#111827" }}>{d.customer_name}</p>
                                          <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>{d.location}</p>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                          {sel && <CheckCircle className="h-4 w-4" style={{ color: "#10B981" }} />}
                                          <button type="button" style={{ fontSize: 12, fontWeight: 600, color: "#059669", background: "none", border: "1px solid #A7F3D0", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={addNewDelivery}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", border: "2px dashed #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#9CA3AF", backgroundColor: "transparent", cursor: "pointer" }}
                                >
                                  <Plus className="h-4 w-4" /> Add Delivery
                                </button>
                              </div>
                            )}
                            {formError && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{formError}</p>}
                          </div>
                        )}
                      </div>

                      {/* Wizard footer */}
                      <div style={{ borderTop: "1px solid #E5E7EB", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          {wizardStep > 1 && (
                            <button
                              type="button"
                              onClick={() => setWizardStep((s) => s - 1)}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#374151", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}
                            >
                              ← Back
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setModalOpen(false)}
                            style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#6B7280", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                        {wizardStep < 4 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (wizardStep === 2 && !wizardName.trim()) { setFormError("Route name is required."); return; }
                              setFormError(null);
                              setWizardStep((s) => s + 1);
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#fff", backgroundColor: "#10B981", border: "none", borderRadius: 8, cursor: "pointer" }}
                          >
                            Continue →
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              if (!wizardName.trim()) { setFormError("Route name is required."); return; }
                              await handleSave(wizardName);
                            }}
                            style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#fff", backgroundColor: "#14532D", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
                          >
                            {saving ? "Creating…" : "Create Route"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
