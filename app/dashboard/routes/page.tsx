"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import {
  Plus, Pencil, Search, X, MapPin, Clock,
  AlertCircle, ChevronDown,
  Eye, Package, CheckCircle, Archive,
  Route as RouteIcon, Layers, Trash2, User, Car,
  LayoutGrid, List,
} from "lucide-react";
import AddressSearch from "@/components/address-search";
import RouteMapScreen from "@/app/screens/route-map-screen";
import MapComponent from "@/components/map-component";
import { supabase, parsePointCoordinates } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { RefreshButton } from "@/components/ui/refresh-button";

// ─── Types ───────────────────────────────────────────────────────────────────

type RouteStatus = "active" | "completed" | "pending" | "cancelled";

type DeliveryStop = {
  id: number;
  customer_name: string;
  location: string;
  coordinates: [number, number] | null;
  item: string;
  phone: string;
  drop_time: string;
  status: string;
  order_index: number | null;
  estimated_value: string | null;
  weight: string | null;
  delivery_notes: string | null;
};

type RouteGroup = {
  id: number;
  provider_id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

type PartnerRoute = {
  id: number;
  name: string;
  status: RouteStatus;
  is_deleted: boolean;
  route_type: "on_demand" | "planned";
  group_id: number | null;
  route_name_id: number | null;
  driver_id: number | null;
  start_location: string | null;
  end_location: string | null;
  total_distance: number | null;
  estimated_duration: number | null;
  efficiency_score: number | null;
  lat: string;
  lng: string;
  service_area: string | null;
  active_days: string[];
  start_time: string;
  end_time: string;
  min_deliveries: number;
  max_deliveries: number | null;
  driver_capacity: number | null;
  max_orders: number | null;
  cutoff_time: string | null;
  created_at: string;
  updated_at: string;
  provider_id: number;
  driver: { id: number; name: string } | null;
  delivery_count: number;
  delivery_stops: DeliveryStop[];
};

type Delivery = {
  id: number;
  route_id: number | null;
  route_name_id: number | null;
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
  route_name_id: string;
  name: string;
  start_location: string;
  start_lat: string;
  start_lng: string;
  end_location: string;
  end_lat: string;
  end_lng: string;
  driver_id: string;
  status: string;
  route_type: "on_demand" | "planned";
  service_area: string;
  active_days: string[];
  start_time: string;
  end_time: string;
  min_deliveries: string;
  max_deliveries: string;
  driver_capacity: string;
  max_orders: string;
  cutoff_time: string;
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
  { key: "on_demand", label: "On-Demand Requests" },
  { key: "planned", label: "Planned Deliveries" },
];

const GROUP_COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F97316", "#EF4444", "#14B8A6",
];

const EMPTY_GROUP_FORM = { name: "", color: "#10B981", route_ids: [] as number[] };

const EMPTY_FORM: FormState = {
  route_name_id: "", name: "", start_location: "", start_lat: "", start_lng: "",
  end_location: "", end_lat: "", end_lng: "", driver_id: "", status: "pending",
  route_type: "on_demand", service_area: "",
  active_days: ["Mon","Tue","Wed","Thu","Fri"],
  start_time: "08:00", end_time: "18:00",
  min_deliveries: "", max_deliveries: "",
  driver_capacity: "", max_orders: "", cutoff_time: "20:00",
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

function buildDeliveryStop(d: Pick<Delivery, "id" | "customer_name" | "location" | "coordinates" | "item" | "phone" | "drop_time" | "status" | "order_index" | "estimated_value" | "weight" | "delivery_notes">): DeliveryStop {
  return {
    id: d.id,
    customer_name: d.customer_name,
    location: d.location,
    coordinates: Array.isArray(d.coordinates)
      ? d.coordinates as [number, number]
      : parsePointCoordinates(d.coordinates as any) as [number, number] | null,
    item: d.item,
    phone: d.phone,
    drop_time: d.drop_time,
    status: d.status,
    order_index: d.order_index,
    estimated_value: d.estimated_value,
    weight: d.weight,
    delivery_notes: d.delivery_notes,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const { toast } = useToast();
  const [view, setView]                     = useState<"list" | "map">("list");
  const [viewMode, setViewMode]             = useState<"grid" | "table">("grid");
  const [mapRoute, setMapRoute]             = useState<any>(null);
  const [mapDeliveries, setMapDeliveries]   = useState<any[]>([]);

  const [routes, setRoutes]                 = useState<PartnerRoute[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [drivers, setDrivers]               = useState<any[]>([]);
  const [routeNamesList, setRouteNamesList]  = useState<{ id: number; name: string }[]>([]);
  const [, setAcceptedRequests] = useState<AcceptedRequest[]>([]);
  const [, setSelectedRequestIds] = useState<Set<number>>(new Set());

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

  const [, setDeliveryMode]                 = useState<"new" | "existing">("new");
  const [, setNewDeliveries]                = useState<DeliveryForm[]>([newDeliveryForm()]);
  const [unassigned, setUnassigned]         = useState<Delivery[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<Set<number>>(new Set());
  const [routeDeliveries, setRouteDeliveries] = useState<Delivery[]>([]);
  const [loadingRouteDeliveries, setLoadingRouteDeliveries] = useState(false);

  // Wizard UI state (shared by create & edit)
  const [wizardStep, setWizardStep]           = useState(1);
  const [, setWizardRequestsTab]                  = useState<"ondemand" | "business">("ondemand");

  // Route groups
  const [groups, setGroups]                   = useState<RouteGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [groupModalOpen, setGroupModalOpen]   = useState(false);
  const [editingGroup, setEditingGroup]       = useState<RouteGroup | null>(null);
  const [groupForm, setGroupForm]             = useState(EMPTY_GROUP_FORM);
  const [savingGroup, setSavingGroup]         = useState(false);
  const [groupFormError, setGroupFormError]   = useState<string | null>(null);
  const [showColorWheel, setShowColorWheel]   = useState(false);
  const [customColors, setCustomColors]       = useState<string[]>([]);

  // Bulk selection
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Reusable confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const openConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = "Delete") =>
    setConfirmModal({ open: true, title, message, confirmLabel, onConfirm });

  const closeConfirm = () =>
    setConfirmModal((m) => ({ ...m, open: false }));

  const [confirmBulkAction, setConfirmBulkAction] = useState<{ type: "delete" | "activate"; count: number } | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [pendingForm, setPendingForm] = useState<FormState | null>(null);
  const [pendingEditRoute, setPendingEditRoute] = useState<PartnerRoute | null>(null);

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

  const fetchRouteNamesList = async () => {
    try {
      const data = await apiFetch("/api/route-names");
      setRouteNamesList(Array.isArray(data) ? data.map((r: any) => ({ id: r.id, name: r.name })) : []);
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

  const fetchRouteDeliveries = async (routeId: number): Promise<Delivery[]> => {
    setLoadingRouteDeliveries(true);
    try {
      const data = await apiFetch(`/api/deliveries?route_id=${routeId}`);
      const deliveries: Delivery[] = Array.isArray(data) ? data : [];
      setRouteDeliveries(deliveries);
      return deliveries;
    } catch { return []; }
    finally { setLoadingRouteDeliveries(false); }
  };

  // Persist delivery_stops to the route so the data is self-contained
  const backfillDeliveryStops = async (routeId: number, deliveries: Delivery[]) => {
    if (!deliveries.length) return;
    const stops = deliveries.map(buildDeliveryStop);
    try {
      await apiFetch(`/api/routes/${routeId}`, {
        method: "PATCH",
        body: JSON.stringify({ delivery_stops: stops }),
      });
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, delivery_stops: stops } : r))
      );
    } catch { /* non-blocking */ }
  };

  const fetchGroups = async () => {
    try {
      const data = await apiFetch("/api/route-groups");
      setGroups(Array.isArray(data) ? data : []);
    } catch { /* non-blocking */ }
  };

  useEffect(() => {
    fetchRoutes();
    fetchDrivers();
    fetchGroups();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = routes;
    if (activeTab === "active")      list = list.filter((r) => r.status === "active");
    else if (activeTab === "at_capacity") list = list.filter((r) => r.status === "pending");
    else if (activeTab === "archived")    list = list.filter((r) => ["completed", "cancelled"].includes(r.status));
    if (modeTab !== "all") list = list.filter((r) => r.route_type === modeTab);
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
  }, [routes, activeTab, modeTab, search]);


  const allFilteredSelected  = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
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
      const allSelected = filtered.every((r) => prev.has(r.id));
      const next = new Set(prev);
      filtered.forEach((r) => allSelected ? next.delete(r.id) : next.add(r.id));
      return next;
    });
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDelete = () => {
    if (!selectedIds.size) return;
    setConfirmBulkAction({ type: "delete", count: selectedIds.size });
  };

  const handleBulkActivate = () => {
    if (!selectedIds.size) return;
    setConfirmBulkAction({ type: "activate", count: selectedIds.size });
  };

  const executeBulkAction = async () => {
    const action = confirmBulkAction;
    setConfirmBulkAction(null);
    if (!action) return;
    setBulkProcessing(true);
    const ids = [...selectedIds];
    const succeeded = new Set<number>();
    for (const id of ids) {
      try {
        if (action.type === "delete") {
          await apiFetch(`/api/routes/${id}`, { method: "DELETE" });
        } else {
          await apiFetch(`/api/routes/${id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
        }
        succeeded.add(id);
      } catch { /* skip */ }
    }
    if (action.type === "delete") {
      setRoutes((prev) => prev.filter((r) => !succeeded.has(r.id)));
      if (viewRoute && succeeded.has(viewRoute.id)) setViewOpen(false);
    } else {
      await fetchRoutes();
    }
    setSelectedIds(new Set());
    setBulkProcessing(false);
    const label = action.type === "delete" ? "deleted" : "activated";
    toast({ title: `Routes ${label}`, description: `${succeeded.size} of ${ids.length} route${ids.length !== 1 ? "s" : ""} ${label}.` });
  };

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
    setWizardStep(1);
    setWizardRequestsTab("ondemand");
    fetchUnassigned();
    fetchAcceptedRequests();
    fetchRouteNamesList();
    setModalOpen(true);
  };

  const openEdit = async (route: PartnerRoute) => {
    setEditing(route);
    setWizardStep(1);
    setWizardRequestsTab("ondemand");
    setFormError(null);
    const namesList = await apiFetch("/api/route-names").then(
      (d: any[]) => (Array.isArray(d) ? d.map((r: any) => ({ id: r.id, name: r.name })) : [])
    ).catch(() => [] as { id: number; name: string }[]);
    setRouteNamesList(namesList);
    setForm({
      route_name_id: route.route_name_id ? String(route.route_name_id) : "",
      name: route.name,
      start_location: route.start_location ?? "",
      start_lat: "", start_lng: "",
      end_location: route.end_location ?? "",
      end_lat: "", end_lng: "",
      driver_id: route.driver_id ? String(route.driver_id) : "",
      status: route.status,
      route_type: route.route_type ?? "on_demand",
      service_area: route.service_area ?? "",
      active_days: route.active_days ?? ["Mon","Tue","Wed","Thu","Fri"],
      start_time: route.start_time ?? "08:00",
      end_time: route.end_time ?? "18:00",
      min_deliveries: route.min_deliveries != null ? String(route.min_deliveries) : "",
      max_deliveries: route.max_deliveries != null ? String(route.max_deliveries) : "",
      driver_capacity: route.driver_capacity != null ? String(route.driver_capacity) : "",
      max_orders: route.max_orders != null ? String(route.max_orders) : "",
      cutoff_time: route.cutoff_time ?? "20:00",
    });
    setDeliveryMode("existing");
    setSelectedExisting(new Set());
    setUnassigned([]);
    // Populate immediately from the route's stored delivery_stops (no async wait)
    const storedStops = route.delivery_stops ?? [];
    setRouteDeliveries(
      storedStops.map((s) => ({
        id: s.id,
        route_id: route.id,
        route_name_id: null,
        customer_name: s.customer_name,
        location: s.location,
        coordinates: s.coordinates ?? [0, 0],
        item: s.item,
        phone: s.phone,
        drop_time: s.drop_time,
        status: s.status,
        order_index: s.order_index,
        estimated_value: s.estimated_value,
        weight: s.weight,
        delivery_notes: s.delivery_notes,
      }))
    );
    setModalOpen(true);
    fetchUnassigned();
    fetchAcceptedRequests();
    if (storedStops.length === 0) {
      // Old route — fetch live and persist delivery_stops so future opens are instant
      fetchRouteDeliveries(route.id).then((deliveries) => {
        if (deliveries.length > 0) backfillDeliveryStops(route.id, deliveries);
      });
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const executeUpdate = async () => {
    if (!pendingForm || !pendingEditRoute) return;
    setConfirmUpdate(false);
    setSaving(true);
    setFormError(null);
    try {
      const f = pendingForm;
      const route = pendingEditRoute;
      const payload: any = {
        name: f.name.trim(),
        route_name_id: f.route_name_id ? parseInt(f.route_name_id) : null,
        start_location: f.start_location || null,
        end_location: f.end_location || null,
        driver_id: f.driver_id ? parseInt(f.driver_id) : null,
        status: f.status,
        route_type: f.route_type,
        service_area: f.service_area || null,
        active_days: f.active_days,
        start_time: f.start_time,
        end_time: f.end_time,
        min_deliveries: parseInt(f.min_deliveries) || 0,
        max_deliveries: f.max_deliveries ? parseInt(f.max_deliveries) : null,
        driver_capacity: f.route_type === "on_demand" && f.driver_capacity ? parseInt(f.driver_capacity) : null,
        max_orders: f.route_type === "planned" && f.max_orders ? parseInt(f.max_orders) : null,
        cutoff_time: f.route_type === "planned" && f.cutoff_time ? f.cutoff_time : null,
        ...(f.start_lat && { lat: f.start_lat, lng: f.start_lng }),
        // Build delivery_stops from current "on this route" list + newly selected ones
        delivery_stops: [
          ...routeDeliveries.map(buildDeliveryStop),
          ...unassigned.filter((d) => selectedExisting.has(d.id)).map(buildDeliveryStop),
        ],
      };
      await apiFetch(`/api/routes/${route.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      for (const deliveryId of Array.from(selectedExisting)) {
        await apiFetch(`/api/deliveries/${deliveryId}`, { method: "PATCH", body: JSON.stringify({ route_id: route.id }) });
      }
      await fetchRoutes();
      toast({ title: "Route updated", description: `"${f.name}" has been saved.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update route." });
    } finally {
      setSaving(false);
      setPendingForm(null);
      setPendingEditRoute(null);
    }
  };

  const handleSave = async (nameOverride?: string) => {
    const routeName = nameOverride ?? form.name;
    if (!routeName.trim()) { setFormError("Route name is required."); return; }

    if (editing) {
      setPendingForm({ ...form, name: routeName });
      setPendingEditRoute(editing);
      setConfirmUpdate(true);
      setModalOpen(false);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        name: routeName.trim(),
        route_name_id: form.route_name_id ? parseInt(form.route_name_id) : null,
        start_location: form.start_location || null,
        end_location: form.end_location || null,
        driver_id: form.driver_id ? parseInt(form.driver_id) : null,
        status: form.status,
        route_type: form.route_type,
        service_area: form.service_area || null,
        active_days: form.active_days,
        start_time: form.start_time,
        end_time: form.end_time,
        min_deliveries: parseInt(form.min_deliveries) || 0,
        max_deliveries: form.max_deliveries ? parseInt(form.max_deliveries) : null,
        driver_capacity: form.route_type === "on_demand" && form.driver_capacity ? parseInt(form.driver_capacity) : null,
        max_orders: form.route_type === "planned" && form.max_orders ? parseInt(form.max_orders) : null,
        cutoff_time: form.route_type === "planned" && form.cutoff_time ? form.cutoff_time : null,
        lat: form.start_lat || "0",
        lng: form.start_lng || "0",
        delivery_stops: unassigned.filter((d) => selectedExisting.has(d.id)).map(buildDeliveryStop),
      };

      const created = await apiFetch("/api/routes", { method: "POST", body: JSON.stringify(payload) });
      for (const deliveryId of Array.from(selectedExisting)) {
        await apiFetch(`/api/deliveries/${deliveryId}`, {
          method: "PATCH", body: JSON.stringify({ route_id: created.id }),
        });
      }
      await fetchRoutes();
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save route");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete / Archive ───────────────────────────────────────────────────────

  const handleDelete = (route: PartnerRoute) => {
    openConfirm(
      `Do you want to delete "${route.name}"?`,
      "",
      async () => {
        closeConfirm();
        setDeletingId(route.id);
        try {
          await apiFetch(`/api/routes/${route.id}`, { method: "DELETE" });
          setRoutes((prev) => prev.filter((r) => r.id !== route.id));
          if (viewRoute?.id === route.id) setViewOpen(false);
          toast({ title: "Route deleted", description: `"${route.name}" has been removed.` });
        } catch (err) {
          toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete route." });
        } finally { setDeletingId(null); }
      },
      "Delete"
    );
  };

  // ── Route groups ──────────────────────────────────────────────────────────

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupFormError(null);
    setShowColorWheel(false);
    setGroupModalOpen(true);
  };

  const openEditGroup = (group: RouteGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      color: group.color,
      route_ids: routes.filter((r) => r.group_id === group.id).map((r) => r.id),
    });
    setGroupFormError(null);
    setShowColorWheel(false);
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) { setGroupFormError("Group name is required."); return; }
    setSavingGroup(true);
    setGroupFormError(null);
    try {
      if (editingGroup) {
        const updated = await apiFetch(`/api/route-groups/${editingGroup.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: groupForm.name, color: groupForm.color, route_ids: groupForm.route_ids }),
        });
        setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
        setRoutes((prev) => prev.map((r) => {
          if (groupForm.route_ids.includes(r.id)) return { ...r, group_id: editingGroup.id };
          if (r.group_id === editingGroup.id) return { ...r, group_id: null };
          return r;
        }));
      } else {
        const created = await apiFetch("/api/route-groups", {
          method: "POST",
          body: JSON.stringify({ name: groupForm.name, color: groupForm.color, route_ids: groupForm.route_ids }),
        });
        setGroups((prev) => [...prev, created]);
        setRoutes((prev) => prev.map((r) =>
          groupForm.route_ids.includes(r.id) ? { ...r, group_id: created.id } : r
        ));
      }
      setGroupModalOpen(false);
    } catch (err) {
      setGroupFormError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = (group: RouteGroup) => {
    openConfirm(
      `Do you want to delete "${group.name}"?`,
      "",
      async () => {
        closeConfirm();
        try {
          await apiFetch(`/api/route-groups/${group.id}`, { method: "DELETE" });
          setGroups((prev) => prev.filter((g) => g.id !== group.id));
          setRoutes((prev) => prev.map((r) => r.group_id === group.id ? { ...r, group_id: null } : r));
        } catch { /* silent */ }
      },
      "Delete Group"
    );
  };

  const toggleGroupCollapse = (groupId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const toggleGroupRoute = (routeId: number) => {
    setGroupForm((f) => ({
      ...f,
      route_ids: f.route_ids.includes(routeId)
        ? f.route_ids.filter((id) => id !== routeId)
        : [...f.route_ids, routeId],
    }));
  };

  // ── View map ───────────────────────────────────────────────────────────────

  const handleViewMap = async (route: PartnerRoute) => {
    const stops = route.delivery_stops ?? [];

    // Build formatted markers from delivery_stops (already have parsed coordinates)
    let formatted = stops.map((s) => ({
      id: s.id,
      customer_name: s.customer_name,
      location: s.location,
      coordinates: (Array.isArray(s.coordinates) ? s.coordinates : [0, 0]) as [number, number],
      item: s.item,
      estimated_value: s.estimated_value,
      weight: s.weight,
      phone: s.phone,
      drop_time: s.drop_time,
      status: s.status as "pending" | "in-progress" | "completed" | "failed",
    }));

    // Fall back to live fetch for routes that predate the delivery_stops column
    if (formatted.length === 0) {
      try {
        const deliveriesData: Delivery[] = await apiFetch(`/api/deliveries?route_id=${route.id}`);
        formatted = deliveriesData.map((d) => ({
          id: d.id, customer_name: d.customer_name, location: d.location,
          coordinates: parsePointCoordinates(d.coordinates) as [number, number],
          item: d.item, estimated_value: d.estimated_value, weight: d.weight,
          phone: d.phone, drop_time: d.drop_time,
          status: d.status as "pending" | "in-progress" | "completed" | "failed",
        }));
        // Backfill delivery_stops so future map loads are instant
        if (deliveriesData.length > 0) backfillDeliveryStops(route.id, deliveriesData);
      } catch {
        alert("Failed to load route deliveries");
        return;
      }
    }

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
  };

  // ── Delivery form helpers ──────────────────────────────────────────────────

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
      const remaining = routeDeliveries.filter((d) => d.id !== deliveryId);
      setRouteDeliveries(remaining);
      // Keep delivery_stops on the route in sync immediately
      if (editing) {
        await apiFetch(`/api/routes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ delivery_stops: remaining.map(buildDeliveryStop) }),
        });
        // Optimistically update the local route in state so the card/map reflects the change
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === editing.id ? { ...r, delivery_stops: remaining.map(buildDeliveryStop) } : r
          )
        );
      }
      fetchUnassigned();
    } catch { alert("Failed to remove delivery"); }
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
              {routes.length} routes · {groups.length} {groups.length === 1 ? "group" : "groups"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <RefreshButton onClick={fetchRoutes} loading={loading} />
            <button
              onClick={openCreateGroup}
              style={{
                padding: "10px 20px", fontSize: 14, fontWeight: 600,
                color: "#374151", backgroundColor: "#FFFFFF",
                border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <Layers className="h-3.5 w-3.5" />
              Create Group
            </button>
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

            {/* Filter tabs + view toggle */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                {/* Select-all checkbox */}
                {filtered.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="shrink-0 flex items-center justify-center h-5 w-5 rounded border border-gray-300 bg-white hover:border-emerald-500 transition-colors"
                    title={allFilteredSelected ? "Deselect all" : "Select all"}
                  >
                    {allFilteredSelected ? (
                      <span className="block h-3 w-3 rounded-sm bg-emerald-500" />
                    ) : someFilteredSelected ? (
                      <span className="block h-0.5 w-2.5 bg-emerald-400 rounded" />
                    ) : null}
                  </button>
                )}
                {/* Status group */}
                <div style={{ display: "flex", gap: 8, backgroundColor: "#F9FAFB", padding: 4, borderRadius: 8, border: "1px solid #E5E7EB" }}>
                  {STATUS_TABS.map(({ key, label }) => (
                    <span
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer", transition: "all 0.2s",
                        backgroundColor: activeTab === key ? "#162318" : "transparent",
                        color: activeTab === key ? "#ffffff" : "#6B7280",
                        border: activeTab === key ? "1px solid transparent" : "1px solid transparent",
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
                        backgroundColor: modeTab === key ? "#162318" : "transparent",
                        color: modeTab === key ? "#ffffff" : "#6B7280",
                        border: "1px solid transparent",
                        boxShadow: modeTab === key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
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
                  onClick={() => setViewMode("table")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "table" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {someFilteredSelected && (
          <div className="px-6 pb-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm text-sm">
              <span className="font-semibold text-gray-700">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-gray-200" />
              <button onClick={handleBulkActivate} disabled={bulkProcessing}
                className="font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40 transition-colors">
                Activate
              </button>
              <button onClick={handleBulkDelete} disabled={bulkProcessing}
                className="font-medium text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors">
                {bulkProcessing ? "Processing…" : "Archive"}
              </button>
              <button onClick={clearSelection}
                className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
                <X className="h-3.5 w-3.5" />
              </button>
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
            {/* ── Table view ── */}
            {filtered.length > 0 && viewMode === "table" && (
              <div style={{ padding: "0 24px 24px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                      <th style={{ paddingBottom: 10, paddingTop: 4, paddingRight: 16, width: 32 }} />
                      {["Route", "Type", "Status", "Driver", "Vehicle", "Schedule", "Actions"].map((h, i) => (
                        <th key={h} style={{ paddingBottom: 10, paddingTop: 4, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", textAlign: i === 6 ? "right" : "left", paddingRight: i < 6 ? 16 : 0, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((route) => {
                      const statusDisplay = getStatusDisplay(route.status);
                      const typeBg    = route.route_type === "planned" ? "#F0FDF4" : "#EEF2FF";
                      const typeColor = route.route_type === "planned" ? "#15803D" : "#4338CA";
                      const scheduleDays = Array.isArray(route.active_days) && route.active_days.length ? route.active_days.join(", ") : null;
                      const scheduleTime = route.start_time && route.end_time ? `${route.start_time} - ${route.end_time}` : null;
                      const scheduleLabel = [scheduleDays, scheduleTime].filter(Boolean).join(" · ");
                      const group = groups.find((g) => g.id === route.group_id);
                      return (
                        <tr key={route.id} style={{ borderBottom: "1px solid #F3F4F6", backgroundColor: selectedIds.has(route.id) ? "rgba(236,253,245,0.6)" : "transparent" }}
                          onMouseEnter={(e) => { if (!selectedIds.has(route.id)) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#FAFAFA"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = selectedIds.has(route.id) ? "rgba(236,253,245,0.6)" : "transparent"; }}>
                          {/* Checkbox */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle" }}>
                            <button
                              onClick={() => toggleSelect(route.id)}
                              className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                                selectedIds.has(route.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                              }`}
                            >
                              {selectedIds.has(route.id) && (
                                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                          </td>
                          {/* Route name */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: group ? group.color + "20" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${group ? group.color + "40" : "#E5E7EB"}` }}>
                                <RouteIcon className="h-3.5 w-3.5" style={{ color: group ? group.color : "#9CA3AF" }} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{route.name}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{routeIdLabel(route.id)}{group ? ` · ${group.name}` : ""}</div>
                              </div>
                            </div>
                          </td>
                          {/* Type */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, backgroundColor: typeBg, color: typeColor, whiteSpace: "nowrap" }}>
                              {route.route_type}
                            </span>
                          </td>
                          {/* Status */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, backgroundColor: statusDisplay.bgColor, color: statusDisplay.textColor, whiteSpace: "nowrap" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusDisplay.dotColor, display: "inline-block", flexShrink: 0 }} />
                              {statusDisplay.label}
                            </span>
                          </td>
                          {/* Driver */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle", fontSize: 13, color: route.driver ? "#374151" : "#D1D5DB", whiteSpace: "nowrap" }}>
                            {route.driver ? route.driver.name : "—"}
                          </td>
                          {/* Vehicle */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle" }}>
                            {(() => {
                              const driverRecord = drivers.find((d) => d.id === route.driver_id);
                              const vehicle = driverRecord?.assigned_vehicle;
                              if (!vehicle) return <span style={{ color: "#D1D5DB", fontSize: 13 }}>—</span>;
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <Car style={{ width: 13, height: 13, color: "#9CA3AF", flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                                    {vehicle.plate_number}
                                    {vehicle.vehicle_type ? <span style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 4 }}>· {vehicle.vehicle_type}</span> : null}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          {/* Schedule */}
                          <td style={{ padding: "14px 16px 14px 0", verticalAlign: "middle", fontSize: 12, color: "#6B7280", maxWidth: 220 }}>
                            {scheduleLabel
                              ? <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scheduleLabel}</span>
                              : <span style={{ color: "#D1D5DB" }}>—</span>}
                          </td>
                          {/* Actions */}
                          <td style={{ padding: "14px 0 14px 0", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                              <button onClick={() => handleView(route)} title="View"
                                style={{ padding: "6px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#374151"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F3F4F6"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
                                <Eye style={{ width: 16, height: 16 }} />
                              </button>
                              <button onClick={() => openEdit(route)} title="Edit"
                                style={{ padding: "6px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#374151"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F3F4F6"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
                                <Pencil style={{ width: 16, height: 16 }} />
                              </button>
                              <button onClick={() => handleDelete(route)} title="Archive"
                                style={{ padding: "6px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "#FCA5A5", display: "flex", alignItems: "center" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FEF2F2"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FCA5A5"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
                                <Trash2 style={{ width: 16, height: 16 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ marginTop: 16, fontSize: 12, color: "#9CA3AF" }}>
                  {filtered.length} route{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* ── Card / Grid view (grouped + ungrouped) ── */}
            {filtered.length > 0 && viewMode === "grid" && (() => {
              const gridStyle = {
                display: "grid" as const,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 400px), 1fr))",
                gap: 20,
              };

              const renderCard = (route: PartnerRoute, i: number) => {
                const statusDisplay = getStatusDisplay(route.status);
                const isViewing = viewRoute?.id === route.id && viewOpen;
                const typeLabel = route.route_type;
                const typeBg   = route.route_type === "planned" ? "#F0FDF4" : "#EEF2FF";
                const typeColor = route.route_type === "planned" ? "#15803D" : "#4338CA";
                const scheduleDays = Array.isArray(route.active_days) && route.active_days.length
                  ? route.active_days.join(", ")
                  : null;
                const scheduleTime = route.start_time && route.end_time
                  ? `${route.start_time} - ${route.end_time}`
                  : null;
                const scheduleLabel = [scheduleDays, scheduleTime].filter(Boolean).join(" · ");
                return (
                  <div
                    key={route.id}
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: selectedIds.has(route.id) ? "1.5px solid #10B981" : isViewing ? "1.5px solid #0F6D48" : "1px solid #E5E7EB",
                      borderRadius: 12, overflow: "hidden",
                      animation: "fadeInUp 0.4s ease forwards",
                      animationDelay: `${i * 40}ms`, opacity: 0,
                      display: "flex", flexDirection: "column",
                      boxShadow: selectedIds.has(route.id) ? "0 0 0 1px #A7F3D0" : undefined,
                    }}
                  >
                    {/* Header */}
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", position: "relative" }}>
                      {/* Trash + Checkbox — top right */}
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(route)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Archive route"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleSelect(route.id)}
                          className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                            selectedIds.has(route.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                          }`}
                          title="Select route"
                        >
                          {selectedIds.has(route.id) && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {/* Name + route id */}
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2, paddingRight: 56 }}>{route.name}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginBottom: 10 }}>{routeIdLabel(route.id)}</div>
                      {/* Badges row — always below title, never overlaps */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, backgroundColor: statusDisplay.bgColor, color: statusDisplay.textColor }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusDisplay.dotColor, display: "inline-block" }} />
                          {statusDisplay.label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, backgroundColor: typeBg, color: typeColor }}>
                          {typeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Info rows */}
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                      {route.start_location && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.start_location}</span>
                        </div>
                      )}
                      {route.end_location && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.end_location}</span>
                        </div>
                      )}
                      {route.driver && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                          <User className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.driver.name}</span>
                        </div>
                      )}
                      {(() => {
                        if (!route.driver_id) return null;
                        const driverRecord = drivers.find((d) => d.id === route.driver_id);
                        const vehicle = driverRecord?.assigned_vehicle;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: vehicle ? "#374151" : "#9CA3AF" }}>
                            <Car className="h-3.5 w-3.5 shrink-0" style={{ color: vehicle ? "#6B7280" : "#D1D5DB" }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {vehicle
                                ? `${vehicle.plate_number}${vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ""}`
                                : "No vehicle assigned yet"}
                            </span>
                          </div>
                        );
                      })()}
                      {scheduleLabel && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                          <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#6B7280" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scheduleLabel}</span>
                        </div>
                      )}
                      {!route.start_location && !route.end_location && !route.driver && !scheduleLabel && (
                        <div style={{ fontSize: 13, color: "#9CA3AF" }}>No location info</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: "14px 20px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 10 }}>
                      <button onClick={() => handleView(route)} style={{ flex: 1, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: isViewing ? "#0F6D48" : "#374151", backgroundColor: isViewing ? "#F0FDF4" : "#FFFFFF", border: isViewing ? "1px solid #0F6D48" : "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        onMouseEnter={(e) => { if (!isViewing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F9FAFB"; }}
                        onMouseLeave={(e) => { if (!isViewing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = isViewing ? "#F0FDF4" : "#FFFFFF"; }}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => openEdit(route)} style={{ flex: 1, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#0F6D48", backgroundColor: "#F0FDF4", border: "1px solid #0F6D48", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E8F5ED")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F0FDF4")}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </div>
                  </div>
                );
              };

              const ungrouped = filtered.filter((r) => !r.group_id);

              return (
                <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
                  {/* Named groups */}
                  {groups.map((group) => {
                    const groupRoutes = filtered.filter((r) => r.group_id === group.id);
                    if (groupRoutes.length === 0) return null;
                    const isCollapsed = collapsedGroups.has(group.id);
                    return (
                      <div key={group.id}>
                        <div
                          onClick={() => toggleGroupCollapse(group.id)}
                          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isCollapsed ? 0 : 16, padding: "10px 16px", backgroundColor: "#F9FAFB", borderRadius: 8, borderLeft: `4px solid ${group.color}`, cursor: "pointer", userSelect: "none" }}
                        >
                          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: group.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#111827" }}>{group.name}</span>
                          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500, padding: "2px 8px", backgroundColor: "#E5E7EB", borderRadius: 999 }}>
                            {groupRoutes.length} {groupRoutes.length === 1 ? "route" : "routes"}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditGroup(group); }}
                            style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#374151", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                            style={{ padding: "4px 8px", fontSize: 12, color: "#EF4444", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <ChevronDown className="h-4 w-4" style={{ color: "#6B7280", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
                        </div>
                        {!isCollapsed && (
                          <div style={gridStyle}>{groupRoutes.map((r, i) => renderCard(r, i))}</div>
                        )}
                      </div>
                    );
                  })}

                  {/* Ungrouped routes */}
                  {ungrouped.length > 0 && (
                    <div>
                      {groups.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 16px", backgroundColor: "#F9FAFB", borderRadius: 8, borderLeft: "4px solid #D1D5DB" }}>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#6B7280" }}>Ungrouped</span>
                          <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, padding: "2px 8px", backgroundColor: "#E5E7EB", borderRadius: 999 }}>
                            {ungrouped.length} {ungrouped.length === 1 ? "route" : "routes"}
                          </span>
                        </div>
                      )}
                      <div style={gridStyle}>{ungrouped.map((r, i) => renderCard(r, i))}</div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                    backgroundColor: viewRoute.route_type === "planned" ? "#FFF7ED" : "#EEF2FF",
                    color: viewRoute.route_type === "planned" ? "#C2410C" : "#4338CA",
                  }}>
                    {viewRoute.route_type === "planned" ? "Planned Deliveries" : "On-Demand Requests"}
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
                  {editing ? `Edit Route — ${editing.name}` : "Create New Route"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {wizardStep === 2
                    ? form.route_type === "on_demand"
                      ? "Add On-Demand Requests"
                      : "Add Planned Deliveries"
                    : editing
                      ? "Update route details and manage deliveries."
                      : "Define route identity, coverage and schedule"
                  }
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Wizard (2 steps: INFO → REQUESTS) ── */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Step progress bar */}
              {(() => {
                const STEPS = ["INFO", "REQUESTS"];
                const StepCircle = ({ n }: { n: number }) => {
                  const done = wizardStep > n;
                  const active = wizardStep === n;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: done ? "#10B981" : "transparent", border: done ? "none" : active ? "2px solid #10B981" : "2px solid #D1D5DB" }}>
                        {done
                          ? <CheckCircle className="h-4 w-4" style={{ color: "#fff" }} />
                          : <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#10B981" : "#9CA3AF" }}>{n}</span>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#10B981" : done ? "#10B981" : "#9CA3AF", letterSpacing: "0.05em" }}>{STEPS[n - 1]}</span>
                    </div>
                  );
                };
                return (
                  <div style={{ padding: "20px 32px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                    {[1, 2].map((n) => (
                      <div key={n} style={{ display: "flex", alignItems: "flex-start" }}>
                        <StepCircle n={n} />
                        {n < 2 && <div style={{ width: 120, height: 2, backgroundColor: wizardStep > n ? "#10B981" : "#E5E7EB", marginTop: 15 }} />}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Step content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>

                {/* STEP 1: INFO */}
                {wizardStep === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Route Information</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Define route identity, coverage and schedule</p>
                    </div>

                    {/* Row 1: Route Name + Assign Driver */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                          Route Name <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          list="route-names-datalist"
                          value={form.name}
                          onChange={(e) => {
                            const typed = e.target.value;
                            const matched = routeNamesList.find((r) => r.name === typed);
                            setForm((f) => ({ ...f, name: typed, route_name_id: matched ? String(matched.id) : "" }));
                          }}
                          placeholder="Enter route name"
                          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", backgroundColor: "#fff", color: "#111827" }}
                        />
                        <datalist id="route-names-datalist">
                          {routeNamesList.map((r) => (
                            <option key={r.id} value={r.name} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                          Assign Driver <span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF" }}>(Optional)</span>
                        </label>
                        <select
                          value={form.driver_id}
                          onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
                          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", backgroundColor: "#fff", color: "#111827" }}
                        >
                          <option value="">Select a driver...</option>
                          {drivers
                            .filter((d) => {
                              // Always include the currently assigned driver when editing
                              if (editing && String(d.id) === form.driver_id) return true;
                              return d.status === "active";
                            })
                            .filter((d) => {
                              const assignedRouteId = routes.find(
                                (r) => r.driver_id === d.id && r.id !== (editing?.id ?? -1)
                              )?.id;
                              return !assignedRouteId;
                            })
                            .map((d) => (
                              <option key={d.id} value={String(d.id)}>{d.full_name}</option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Start + End Location */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                          Start Location <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <AddressSearch
                          key={`start-${editing?.id ?? "new"}`}
                          value={form.start_location}
                          placeholder="Search for starting point"
                          onSelect={(r) => setForm((f) => ({
                            ...f,
                            start_location: r.display_name,
                            start_lat: r.coordinates ? String(r.coordinates[0]) : f.start_lat,
                            start_lng: r.coordinates ? String(r.coordinates[1]) : f.start_lng,
                          }))}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                          End Location <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <AddressSearch
                          key={`end-${editing?.id ?? "new"}`}
                          value={form.end_location}
                          placeholder="Search for ending point"
                          onSelect={(r) => setForm((f) => ({
                            ...f,
                            end_location: r.display_name,
                            end_lat: r.coordinates ? String(r.coordinates[0]) : f.end_lat,
                            end_lng: r.coordinates ? String(r.coordinates[1]) : f.end_lng,
                          }))}
                        />
                      </div>
                    </div>

                    {/* Delivery Type */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        Delivery Type <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <select
                        value={form.route_type}
                        onChange={(e) => setForm((f) => ({ ...f, route_type: e.target.value as "on_demand" | "planned" }))}
                        style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", backgroundColor: "#fff", color: "#111827" }}
                      >
                        <option value="on_demand">On-Demand Requests</option>
                        <option value="planned">Planned Deliveries</option>
                      </select>
                    </div>

                    {/* Service Area */}
                    <div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        Service Area <span style={{ color: "#EF4444" }}>*</span>
                        <span title="Comma-separated areas this route covers" style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "#E5E7EB", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6B7280", cursor: "default" }}>i</span>
                      </label>
                      <input
                        type="text"
                        value={form.service_area}
                        onChange={(e) => setForm((f) => ({ ...f, service_area: e.target.value }))}
                        placeholder="e.g., Westlands, Parklands, Highridge"
                        style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9CA3AF" }}>Comma-separated areas this route will cover</p>
                    </div>

                    {/* Active Days */}
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                        Active Days <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => {
                          const on = form.active_days.includes(d);
                          return (
                            <button key={d} type="button"
                              onClick={() => setForm((f) => ({ ...f, active_days: on ? f.active_days.filter((x) => x !== d) : [...f.active_days, d] }))}
                              style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: on ? "2px solid #10B981" : "2px solid #E5E7EB", backgroundColor: on ? "#F0FDF4" : "#fff", color: on ? "#059669" : "#6B7280", transition: "all 0.12s" }}
                            >{d}</button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Start + End Time */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Start Time <span style={{ color: "#EF4444" }}>*</span></label>
                        <input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>End Time <span style={{ color: "#EF4444" }}>*</span></label>
                        <input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                      </div>
                    </div>

                    {/* Planned Delivery Configuration — create only */}
                    {!editing && form.route_type === "planned" && (
                      <div style={{ borderLeft: "4px solid #10B981", paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
                        <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#065F46" }}>Planned Delivery Configuration</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Max Orders</label>
                            <input type="number" min="1" value={form.max_orders} placeholder="100" onChange={(e) => setForm((f) => ({ ...f, max_orders: e.target.value }))}
                              style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Order Cutoff Time</label>
                            <input type="time" value={form.cutoff_time} onChange={(e) => setForm((f) => ({ ...f, cutoff_time: e.target.value }))}
                              style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status — edit only */}
                    {editing && (
                      <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Route Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                          style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", backgroundColor: "#fff", color: "#111827" }}
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    )}

                    {formError && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{formError}</p>}
                  </div>
                )}

                {/* STEP 2: Select deliveries to add to the route */}
                {wizardStep === 2 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
                        {editing ? "Manage Deliveries" : "Select Deliveries"}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
                        {editing
                          ? "Remove deliveries from this route or add new ones."
                          : "Choose which deliveries to include in this route. Manage deliveries on the Deliveries page."}
                      </p>
                    </div>

                    {/* Edit mode: currently assigned deliveries */}
                    {editing && (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                          On this route ({loadingRouteDeliveries ? "…" : routeDeliveries.length})
                        </p>
                        {loadingRouteDeliveries ? (
                          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Loading deliveries…</p>
                        ) : routeDeliveries.length === 0 ? (
                          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No deliveries assigned yet.</p>
                        ) : (
                          <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
                            {routeDeliveries.map((d, i) => {
                              let itemLabel = "";
                              try {
                                const parsed = typeof d.item === "string" ? JSON.parse(d.item) : d.item;
                                itemLabel = Array.isArray(parsed)
                                  ? parsed.map((it: { name?: string }) => it.name).filter(Boolean).join(", ")
                                  : typeof parsed === "string" ? parsed : "";
                              } catch { itemLabel = typeof d.item === "string" ? d.item : ""; }
                              return (
                                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < routeDeliveries.length - 1 ? "1px solid #F3F4F6" : "none", backgroundColor: "#fff" }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.customer_name}</p>
                                    <p style={{ margin: 0, fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      DEL-{String(d.id).padStart(4, "0")} · {d.location.split(",")[0]}{itemLabel ? ` · ${itemLabel}` : ""}
                                    </p>
                                  </div>
                                  <button type="button" onClick={() => handleRemoveFromRoute(d.id)}
                                    style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#DC2626", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}>
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selected to add */}
                    {selectedExisting.size > 0 && (() => {
                      const selectedDeliveries = unassigned.filter((d) => selectedExisting.has(d.id));
                      return (
                        <div>
                          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                            Selected to add ({selectedExisting.size})
                          </p>
                          <div style={{ border: "1px solid #A7F3D0", borderRadius: 10, overflow: "hidden", backgroundColor: "#F0FDF4" }}>
                            {selectedDeliveries.map((d, i) => {
                              let itemLabel = "";
                              try {
                                const parsed = typeof d.item === "string" ? JSON.parse(d.item) : d.item;
                                itemLabel = Array.isArray(parsed)
                                  ? parsed.map((it: { name?: string }) => it.name).filter(Boolean).join(", ")
                                  : typeof parsed === "string" ? parsed : "";
                              } catch { itemLabel = typeof d.item === "string" ? d.item : ""; }
                              return (
                                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < selectedDeliveries.length - 1 ? "1px solid #D1FAE5" : "none" }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#065F46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.customer_name}</p>
                                    <p style={{ margin: 0, fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      DEL-{String(d.id).padStart(4, "0")} · {d.location.split(",")[0]}{itemLabel ? ` · ${itemLabel}` : ""}
                                    </p>
                                  </div>
                                  <button type="button" onClick={() => toggleExisting(d.id)}
                                    style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #6EE7B7", backgroundColor: "#ECFDF5", color: "#059669", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}
                                    title="Remove from selection">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Route name filter notice */}
                    {form.route_name_id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
                        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#3B82F6" }} />
                        <p style={{ margin: 0, fontSize: 12, color: "#1E40AF" }}>
                          Filtered to deliveries assigned to the selected route name.
                        </p>
                      </div>
                    )}

                    {/* Delivery list */}
                    {(() => {
                      const selectedRouteNameId = form.route_name_id ? parseInt(form.route_name_id) : null;
                      const visibleDeliveries = selectedRouteNameId != null
                        ? unassigned.filter((d) => d.route_name_id === selectedRouteNameId)
                        : unassigned;
                      return (
                        <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", maxHeight: 400, overflowY: "auto" }}>
                          {visibleDeliveries.length === 0 ? (
                            <div style={{ padding: "48px 0", textAlign: "center" }}>
                              <Package className="h-8 w-8 mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                              <p style={{ fontSize: 13, margin: "0 0 4px", color: "#9CA3AF" }}>
                                {selectedRouteNameId != null ? "No deliveries for this route name" : "No unassigned deliveries"}
                              </p>
                              <p style={{ fontSize: 12, margin: 0, color: "#D1D5DB" }}>
                                Go to the Deliveries page to create or manage deliveries
                              </p>
                            </div>
                          ) : visibleDeliveries.map((d, i) => {
                            const sel = selectedExisting.has(d.id);
                            const statusBadge = d.status === "out_for_delivery"
                              ? { label: "OUT FOR DELIVERY", bg: "#EDE9FE", color: "#5B21B6" }
                              : d.status === "pending"
                              ? { label: "APPROVED", bg: "#ECFDF5", color: "#065F46" }
                              : d.status === "awaiting_approval"
                              ? { label: "AWAITING APPROVAL", bg: "#EFF6FF", color: "#1D4ED8" }
                              : { label: d.status.toUpperCase().replace(/_/g, " "), bg: "#F3F4F6", color: "#374151" };
                            const area = d.location.split(",")[0] ?? d.location;
                            let itemLabel = "";
                            try {
                              const parsed = typeof d.item === "string" ? JSON.parse(d.item) : d.item;
                              if (Array.isArray(parsed)) {
                                itemLabel = parsed.map((it: { name?: string }) => it.name).filter(Boolean).join(", ");
                              } else if (typeof parsed === "string") {
                                itemLabel = parsed;
                              }
                            } catch {
                              itemLabel = typeof d.item === "string" ? d.item : "";
                            }
                            return (
                              <div key={d.id}
                                onClick={() => toggleExisting(d.id)}
                                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer", transition: "background 0.12s", backgroundColor: sel ? "#F0FDF4" : "#fff", borderLeft: `3px solid ${sel ? "#10B981" : "transparent"}`, borderBottom: i < visibleDeliveries.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                                {/* Checkbox */}
                                <div style={{ width: 18, height: 18, borderRadius: 4, border: sel ? "none" : "1.5px solid #D1D5DB", backgroundColor: sel ? "#10B981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {sel && <CheckCircle className="h-3.5 w-3.5" style={{ color: "#fff" }} />}
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.customer_name}</p>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, backgroundColor: statusBadge.bg, color: statusBadge.color, flexShrink: 0 }}>
                                      {statusBadge.label}
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    DEL-{String(d.id).padStart(4, "0")} &bull; {area}
                                    {itemLabel ? ` · ${itemLabel}` : ""}
                                    {d.drop_time ? ` · ${d.drop_time}` : ""}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {formError && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{formError}</p>}
                  </div>
                )}
              </div>

              {/* Wizard footer */}
              <div style={{ borderTop: "1px solid #E5E7EB", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  {wizardStep > 1 && (
                    <button type="button" onClick={() => setWizardStep((s) => s - 1)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#374151", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}>
                      ← Back
                    </button>
                  )}
                  <button type="button" onClick={() => setModalOpen(false)}
                    style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#6B7280", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
                {wizardStep < 2 ? (
                  <button type="button"
                    onClick={() => {
                      if (!form.name.trim()) { setFormError("Route name is required."); return; }
                      if (!form.start_location.trim()) { setFormError("Start location is required."); return; }
                      if (!form.end_location.trim()) { setFormError("End location is required."); return; }
                      setFormError(null);
                      if (editing) {
                        setRouteDeliveries([]);
                        fetchRouteDeliveries(editing.id);
                        fetchUnassigned();
                      }
                      setWizardStep((s) => s + 1);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#162318", backgroundColor: "#CDF782", border: "none", borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
                  >
                    Continue →
                  </button>
                ) : (
                  <button type="button" disabled={saving}
                    onClick={() => handleSave()}
                    style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#162318", backgroundColor: saving ? "#bfe96f" : "#CDF782", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.15s" }}
                    onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f"; }}
                    onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782"; }}
                  >
                    {saving ? (editing ? "Saving…" : "Creating…") : (editing ? "Save Changes" : "Create Route")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ────────────────────────────────────────────────────── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
            style={{ animation: "fadeInUp 0.18s ease forwards" }}
          >
            <div style={{ padding: "28px 28px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#DC2626" }}>
                {confirmModal.title}
              </h3>
            </div>
            <div style={{ padding: "24px 28px 28px", display: "flex", gap: 12 }}>
              <button
                onClick={closeConfirm}
                style={{
                  flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 600,
                  color: "#374151", backgroundColor: "#F9FAFB",
                  border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 600,
                  color: "#fff", backgroundColor: "#EF4444",
                  border: "none", borderRadius: 10, cursor: "pointer",
                }}
              >
                {confirmModal.confirmLabel ?? "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Bulk Action Modal ─────────────────────────────────────────── */}
      {confirmBulkAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{ animation: "fadeInUp 0.18s ease forwards" }}>
            <div style={{ padding: "28px 28px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: confirmBulkAction.type === "delete" ? "#DC2626" : "#111827" }}>
                {confirmBulkAction.type === "delete"
                  ? `Do you want to delete ${confirmBulkAction.count} route${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : `Do you want to activate ${confirmBulkAction.count} route${confirmBulkAction.count !== 1 ? "s" : ""}?`}
              </h3>
            </div>
            <div style={{ padding: "24px 28px 28px", display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmBulkAction(null)}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 600, color: "#374151", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                style={{
                  flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 10, cursor: "pointer",
                  color: confirmBulkAction.type === "delete" ? "#fff" : "#162318",
                  backgroundColor: confirmBulkAction.type === "delete" ? "#EF4444" : "#CDF782",
                }}
              >
                {confirmBulkAction.type === "delete" ? "Delete" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Update Modal ──────────────────────────────────────────────── */}
      {confirmUpdate && pendingForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" style={{ animation: "fadeInUp 0.18s ease forwards" }}>
            <div style={{ padding: "28px 28px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                Do you want to update &ldquo;{pendingForm.name}&rdquo;?
              </h3>
            </div>
            <div style={{ padding: "24px 28px 28px", display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmUpdate(false)}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 600, color: "#374151", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={executeUpdate}
                style={{ flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 600, color: "#162318", backgroundColor: "#CDF782", border: "none", borderRadius: 10, cursor: "pointer" }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Group Modal ─────────────────────────────────────── */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh" }}>

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingGroup ? "Edit Route Group" : "Create Route Group"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">Name your group and add routes to it</p>
              </div>
              <button onClick={() => setGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Group Name */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Group Name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Nairobi North, CBD Routes..."
                    style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    autoFocus
                  />
                </div>

                {/* Color */}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Color</label>

                  {/* All swatches: presets + any custom ones added this session */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {[...GROUP_COLORS, ...customColors].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setGroupForm((f) => ({ ...f, color: c })); setShowColorWheel(false); }}
                        style={{
                          width: 36, height: 36, borderRadius: "50%", backgroundColor: c,
                          border: "none", cursor: "pointer", flexShrink: 0,
                          boxShadow: groupForm.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none",
                          transition: "box-shadow 0.15s",
                        }}
                      />
                    ))}

                    {/* Custom colour toggle — always last */}
                    <button
                      type="button"
                      onClick={() => setShowColorWheel((v) => !v)}
                      title="Pick custom colour"
                      style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        cursor: "pointer", border: "2px dashed #D1D5DB",
                        background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: showColorWheel ? 1 : 0.7,
                        outline: showColorWheel ? "2px solid #6B7280" : "none",
                        outlineOffset: 2,
                      }}
                    />
                  </div>

                  {/* Inline colour wheel */}
                  {showColorWheel && (
                    <div style={{ marginTop: 14, padding: 16, border: "1px solid #E5E7EB", borderRadius: 12, backgroundColor: "#FAFAFA", display: "flex", flexDirection: "column", gap: 14 }}>
                      <HexColorPicker
                        color={groupForm.color}
                        onChange={(c) => setGroupForm((f) => ({ ...f, color: c }))}
                        style={{ width: "100%", height: 180 }}
                      />

                      {/* Live preview + hex input + Apply */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                          backgroundColor: groupForm.color,
                          border: "1px solid #E5E7EB",
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                        }} />
                        <div style={{ flex: 1, position: "relative" }}>
                          <span style={{
                            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                            fontSize: 13, color: "#9CA3AF", fontFamily: "monospace", pointerEvents: "none",
                          }}>#</span>
                          <input
                            value={groupForm.color.replace("#", "")}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                              if (raw.length === 6) setGroupForm((f) => ({ ...f, color: "#" + raw }));
                            }}
                            placeholder="10B981"
                            maxLength={6}
                            style={{
                              width: "100%", border: "1px solid #E5E7EB", borderRadius: 8,
                              padding: "10px 10px 10px 26px", fontSize: 14,
                              fontFamily: "monospace", outline: "none", boxSizing: "border-box",
                              letterSpacing: "0.08em",
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const c = groupForm.color;
                            if (!GROUP_COLORS.includes(c) && !customColors.includes(c)) {
                              setCustomColors((prev) => [...prev, c]);
                            }
                            setShowColorWheel(false);
                          }}
                          style={{
                            padding: "10px 16px", fontSize: 13, fontWeight: 600,
                            color: "#fff", backgroundColor: "#14532D",
                            border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Routes */}
                {(() => {
                  // Show ungrouped routes + (when editing) routes already in this group
                  const availableRoutes = routes.filter((r) =>
                    !r.group_id || (editingGroup && r.group_id === editingGroup.id)
                  );
                  const hiddenCount = routes.length - availableRoutes.length;
                  return (
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          Routes <span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF" }}>({groupForm.route_ids.length} selected)</span>
                        </label>
                        {hiddenCount > 0 && (
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {hiddenCount} already in another group
                          </span>
                        )}
                      </div>
                      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
                        {availableRoutes.length === 0 ? (
                          <p style={{ padding: 20, fontSize: 13, color: "#9CA3AF", textAlign: "center", margin: 0 }}>
                            {routes.length === 0 ? "No routes created yet" : "All routes are already in a group"}
                          </p>
                        ) : (
                          availableRoutes.map((route) => {
                            const checked = groupForm.route_ids.includes(route.id);
                            const statusDisplay = getStatusDisplay(route.status);
                            return (
                              <div
                                key={route.id}
                                onClick={() => toggleGroupRoute(route.id)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                                  borderBottom: "1px solid #F3F4F6", cursor: "pointer",
                                  backgroundColor: checked ? "#F0FDF4" : "#fff",
                                }}
                              >
                                <div style={{
                                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                  border: checked ? "none" : "2px solid #D1D5DB",
                                  backgroundColor: checked ? "#10B981" : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  {checked && <CheckCircle className="h-3 w-3" style={{ color: "#fff" }} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{route.name}</div>
                                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                                    {route.start_location ? route.start_location.split(",")[0] : "No location"} · {routeIdLabel(route.id)}
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, backgroundColor: statusDisplay.bgColor, color: statusDisplay.textColor }}>
                                  {statusDisplay.label.toUpperCase()}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}

                {groupFormError && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{groupFormError}</p>}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0">
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#6B7280", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingGroup}
                onClick={handleSaveGroup}
                style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "#162318", backgroundColor: savingGroup ? "#bfe96f" : "#CDF782", border: "none", borderRadius: 8, cursor: savingGroup ? "not-allowed" : "pointer", opacity: savingGroup ? 0.7 : 1, transition: "all 0.15s" }}
                onMouseEnter={(e) => { if (!savingGroup) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f"; }}
                onMouseLeave={(e) => { if (!savingGroup) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782"; }}
              >
                {savingGroup ? "Saving…" : editingGroup ? "Save Changes" : "Create Group"}
              </button>
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
