"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Truck, Plus, Pencil, Search, X, Eye,
  Bike, Package, CheckCircle2, User,
  Fuel, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FleetService, type FleetVehicle } from "@/lib/services/fleet";
import FleetViewModal from "@/components/FleetViewModal";

type VehicleType = "motorbike" | "bicycle" | "car" | "van" | "truck" | "other";
type FleetStatus = "available" | "assigned" | "in_maintenance";
type FilterTab = "all" | FleetStatus;

// Extend FleetVehicle with enriched driver name from GET
type FleetVehicleEnriched = FleetVehicle & { assigned_driver_name?: string | null };

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all",            label: "All" },
  { key: "available",      label: "Available" },
  { key: "assigned",       label: "Assigned" },
  { key: "in_maintenance", label: "In Maintenance" },
];

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  motorbike: "Motorbike",
  bicycle:   "Bicycle",
  car:       "Car",
  van:       "Van",
  truck:     "Truck",
  other:     "Other",
};

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "motorbike", label: "Motorbike" },
  { value: "bicycle",   label: "Bicycle" },
  { value: "car",       label: "Car" },
  { value: "van",       label: "Van" },
  { value: "truck",     label: "Truck" },
  { value: "other",     label: "Other" },
];

const FUEL_TYPES = [
  { value: "petrol",   label: "Petrol" },
  { value: "diesel",   label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid",   label: "Hybrid" },
  { value: "cng",      label: "CNG" },
  { value: "other",    label: "Other" },
];

const LICENSE_CLASSES = [
  { value: "A1", label: "A1 – Small motorbike (up to 50cc)" },
  { value: "A2", label: "A2 – Medium motorbike" },
  { value: "A3", label: "A3 – Motorbike taxi / courier / Tuk-tuk" },
  { value: "B1", label: "B1 – Private car or small van, manual or automatic" },
  { value: "B2", label: "B2 – Private car or small van, automatic only" },
  { value: "B3", label: "B3 – Private car or small van, professional drivers" },
  { value: "C1", label: "C1 – Light truck: small lorry / pickup" },
  { value: "C",  label: "C – Medium truck with a small trailer" },
  { value: "CE", label: "CE – Heavy truck with a large trailer or semi-trailer" },
  { value: "CD", label: "CD – Heavy truck carrying dangerous / hazardous goods" },
  { value: "D1", label: "D1 – Matatu / minibus" },
  { value: "D2", label: "D2 – Larger minibus" },
  { value: "D3", label: "D3 – Full-size bus" },
  { value: "E",  label: "E – Special professional endorsement" },
  { value: "F",  label: "F – Adapted for persons with disabilities" },
  { value: "G",  label: "G – Tractors, forklifts & heavy machinery" },
];

const STATUS_LABEL: Record<string, string> = {
  available:      "Available",
  assigned:       "Assigned",
  in_maintenance: "In Maintenance",
};

const STATUS_STYLE: Record<string, string> = {
  available:      "bg-emerald-50 text-emerald-700",
  assigned:       "bg-blue-50 text-blue-700",
  in_maintenance: "bg-amber-50 text-amber-700",
};

const STATUS_DOT: Record<string, string> = {
  available:      "bg-emerald-500",
  assigned:       "bg-blue-500",
  in_maintenance: "bg-amber-400",
};

function VehicleIcon({ type, className }: { type: string; className?: string }) {
  if (type === "motorbike" || type === "bicycle") return <Bike className={className} />;
  if (type === "van" || type === "truck") return <Truck className={className} />;
  return <Package className={className} />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

type FormState = {
  plate_number: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  fuel_type: string;
  capacity_kg: string;
  odometer_km: string;
  status: string;
  last_service_date: string;
  insurance_expiry: string;
  inspection_expiry: string;
  allowed_license: string[];
  notes: string;
};

const EMPTY_FORM: FormState = {
  plate_number: "",
  vehicle_type: "motorbike",
  make: "",
  model: "",
  year: "",
  color: "",
  vin: "",
  fuel_type: "",
  capacity_kg: "",
  odometer_km: "",
  status: "available",
  last_service_date: "",
  insurance_expiry: "",
  inspection_expiry: "",
  allowed_license: [],
  notes: "",
};

export default function FleetRegistryPage() {
  const [vehicles, setVehicles]     = useState<FleetVehicleEnriched[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<FilterTab>("all");
  const [search, setSearch]         = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<FleetVehicleEnriched | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);
  const [viewing, setViewing]       = useState<FleetVehicleEnriched | null>(null);

  const fetchVehicles = async () => {
    try {
      setError(null);
      const data = await FleetService.getAll() as FleetVehicleEnriched[];
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (v: FleetVehicleEnriched) => {
    setEditing(v);
    setForm({
      plate_number:      v.plate_number,
      vehicle_type:      v.vehicle_type,
      make:              v.make ?? "",
      model:             v.model ?? "",
      year:              v.year != null ? String(v.year) : "",
      color:             v.color ?? "",
      vin:               v.vin ?? "",
      fuel_type:         v.fuel_type ?? "",
      capacity_kg:       v.capacity_kg != null ? String(v.capacity_kg) : "",
      odometer_km:       v.odometer_km != null ? String(v.odometer_km) : "",
      status:            v.status ?? "available",
      last_service_date: v.last_service_date ?? "",
      insurance_expiry:  v.insurance_expiry ?? "",
      inspection_expiry: v.inspection_expiry ?? "",
      allowed_license:   v.allowed_license
        ? v.allowed_license.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      notes:             v.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const toggleLicense = (val: string) => {
    setForm((f) => ({
      ...f,
      allowed_license: f.allowed_license.includes(val)
        ? f.allowed_license.filter((c) => c !== val)
        : [...f.allowed_license, val],
    }));
  };

  const handleSave = async () => {
    if (!form.plate_number.trim()) { setFormError("Registration plate is required."); return; }
    setSaving(true);
    setFormError(null);
    const payload = {
      plate_number:      form.plate_number.toUpperCase().trim(),
      vehicle_type:      form.vehicle_type,
      make:              form.make.trim() || null,
      model:             form.model.trim() || null,
      year:              form.year ? Number(form.year) : null,
      color:             form.color.trim() || null,
      vin:               form.vin.trim() || null,
      fuel_type:         form.fuel_type || null,
      capacity_kg:       form.capacity_kg ? Number(form.capacity_kg) : null,
      odometer_km:       form.odometer_km ? Number(form.odometer_km) : null,
      status:            form.status || "available",
      last_service_date: form.last_service_date || null,
      insurance_expiry:  form.insurance_expiry || null,
      inspection_expiry: form.inspection_expiry || null,
      allowed_license:   form.allowed_license.length > 0 ? form.allowed_license.join(",") : null,
      notes:             form.notes || null,
    };
    try {
      if (editing) {
        const updated = await FleetService.update(editing.id, payload) as FleetVehicleEnriched;
        setVehicles((prev) => prev.map((v) => v.id === updated.id ? { ...updated, assigned_driver_name: editing.assigned_driver_name } : v));
      } else {
        const created = await FleetService.create(payload) as FleetVehicleEnriched;
        setVehicles((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: FleetVehicleEnriched) => {
    if (!confirm(`Remove ${v.plate_number} from your fleet? This cannot be undone.`)) return;
    setDeletingId(v.id);
    try {
      await FleetService.delete(v.id);
      setVehicles((prev) => prev.filter((x) => x.id !== v.id));
      setViewing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete vehicle");
    } finally {
      setDeletingId(null);
    }
  };

  const tabCounts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: vehicles.length, available: 0, assigned: 0, in_maintenance: 0 };
    vehicles.forEach((v) => { if (v.status in c) c[v.status as FleetStatus]++; });
    return c;
  }, [vehicles]);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? vehicles : vehicles.filter((v) => v.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        v.plate_number.toLowerCase().includes(q) ||
        v.vehicle_type.includes(q) ||
        (v.vin ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, activeTab, search]);

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-8 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Fleet Registry</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} ·{" "}
              {tabCounts.available} available · {tabCounts.assigned} assigned ·{" "}
              {tabCounts.in_maintenance} in maintenance
            </p>
          </div>
          <Button onClick={openAdd} className="shrink-0 gap-2 bg-emerald-700 hover:bg-emerald-800">
            <Plus className="h-4 w-4" />
            Add Vehicle
          </Button>
        </div>

        {/* Search + tabs */}
        {!loading && !error && (
          <div className="px-8 pt-5 pb-4 space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by plate, type or VIN..."
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

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading vehicles...</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-sm font-medium text-red-600">Failed to load vehicles</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchVehicles}>Try again</Button>
          </div>

        ) : vehicles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Truck className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No vehicles yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add your first vehicle to start building your fleet registry.
                </p>
              </div>
              <Button onClick={openAdd} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="h-4 w-4" />
                Add your first vehicle
              </Button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No vehicles found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : (
          <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((vehicle) => {
              const licenses = vehicle.allowed_license
                ? vehicle.allowed_license.split(",").map((c) => c.trim()).filter(Boolean)
                : [];
              return (
                <div key={vehicle.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">

                  {/* Header — icon · plate · type · status */}
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-emerald-600">
                      <VehicleIcon type={vehicle.vehicle_type} className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-gray-900 truncate leading-tight">{vehicle.plate_number}</p>
                      <p className="text-sm text-gray-400 mt-0.5">{VEHICLE_TYPE_LABEL[vehicle.vehicle_type] ?? vehicle.vehicle_type}</p>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[vehicle.status as FleetStatus] ?? "bg-gray-100 text-gray-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[vehicle.status as FleetStatus] ?? "bg-gray-400"}`} />
                      {STATUS_LABEL[vehicle.status as FleetStatus] ?? vehicle.status}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="border-t px-5 py-4 space-y-2.5 text-sm text-gray-600">
                    {/* Capacity */}
                    {vehicle.capacity_kg != null && (
                      <div className="flex items-center gap-2.5">
                        <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>Capacity: <span className="font-semibold text-gray-800">{vehicle.capacity_kg} kg</span></span>
                      </div>
                    )}

                    {/* Assigned driver */}
                    <div className="flex items-center gap-2.5">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      {vehicle.assigned_driver_name
                        ? <span>Assigned to: <span className="font-semibold text-gray-800">{vehicle.assigned_driver_name}</span></span>
                        : <span className="text-gray-400 italic">No driver assigned</span>
                      }
                    </div>

                    {/* Fuel type */}
                    {vehicle.fuel_type && (
                      <div className="flex items-center gap-2.5">
                        <Fuel className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="capitalize">{vehicle.fuel_type}</span>
                      </div>
                    )}

                    {/* Allowed license badges */}
                    {licenses.length > 0 && (
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {licenses.map((c) => (
                            <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="border-t grid grid-cols-2 gap-3 p-3 mt-auto">
                    <button
                      onClick={() => setViewing(vehicle)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={() => openEdit(vehicle)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? "Edit Vehicle" : "Add Vehicle"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editing ? "Update vehicle details." : "Register a new vehicle to your fleet."}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">

              {/* Row 1: Plate + Vehicle Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Registration Plate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., KCA 123A"
                    value={form.plate_number}
                    onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 uppercase placeholder:normal-case"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value as VehicleType }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Make + Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Make</label>
                  <input
                    type="text"
                    placeholder="e.g., Toyota"
                    value={form.make}
                    onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Model</label>
                  <input
                    type="text"
                    placeholder="e.g., Hilux"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 3: Year + Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Year</label>
                  <input
                    type="number"
                    placeholder="e.g., 2020"
                    min={1900}
                    max={new Date().getFullYear() + 1}
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Color</label>
                  <input
                    type="text"
                    placeholder="e.g., White"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 4: VIN + Fuel Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">VIN</label>
                  <input
                    type="text"
                    placeholder="Vehicle Identification Number"
                    value={form.vin}
                    onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Fuel Type</label>
                  <select
                    value={form.fuel_type}
                    onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Select fuel type...</option>
                    {FUEL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Capacity + Odometer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Capacity (kg)</label>
                  <input
                    type="number"
                    placeholder="e.g., 500"
                    value={form.capacity_kg}
                    onChange={(e) => setForm((f) => ({ ...f, capacity_kg: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Odometer Reading (km)</label>
                  <input
                    type="number"
                    placeholder="e.g., 45000"
                    value={form.odometer_km}
                    onChange={(e) => setForm((f) => ({ ...f, odometer_km: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 6: Status + Last Service Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                  >
                    <option value="available">Available</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_maintenance">In Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Last Service Date</label>
                  <input
                    type="date"
                    value={form.last_service_date}
                    onChange={(e) => setForm((f) => ({ ...f, last_service_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 7: Insurance Expiry + Inspection Expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Insurance Expiry</label>
                  <input
                    type="date"
                    value={form.insurance_expiry}
                    onChange={(e) => setForm((f) => ({ ...f, insurance_expiry: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Inspection Expiry</label>
                  <input
                    type="date"
                    value={form.inspection_expiry}
                    onChange={(e) => setForm((f) => ({ ...f, inspection_expiry: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Allowed License Classes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Allowed Driving License
                  <span className="ml-2 text-xs font-normal text-gray-400">Select required license class(es)</span>
                </label>
                <div className="rounded-lg border border-gray-200 p-3 grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {LICENSE_CLASSES.map((lc) => {
                    const checked = form.allowed_license.includes(lc.value);
                    return (
                      <label
                        key={lc.value}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer transition-colors text-sm ${
                          checked
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLicense(lc.value)}
                          className="accent-emerald-700 h-3.5 w-3.5 shrink-0"
                        />
                        <span className="leading-tight">{lc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes about this vehicle..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                Driver assignment is managed from the Drivers page and updates status automatically.
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Vehicle"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <FleetViewModal
        vehicle={viewing}
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        onEdit={() => { setViewing(null); openEdit(viewing!); }}
        onDelete={() => handleDelete(viewing!)}
      />
    </>
  );
}
