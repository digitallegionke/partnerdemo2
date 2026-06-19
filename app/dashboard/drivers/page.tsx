"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, FileText, MapPin, Truck, Eye, Search, CheckCircle2, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import DriverModal from "@/components/DriverModal";
import DriverViewModal from "@/components/DriverViewModal";
import DriverAssignModal from "@/components/DriverAssignModal";
import { DriverService } from "@/lib/services/drivers";
import type { Database } from "@/lib/supabase";

type Driver = Database["public"]["Tables"]["partner_drivers"]["Row"] & {
  assigned_vehicle?: { plate_number: string; vehicle_type: string; assigned_from: string } | null;
  availability: "available" | "on_duty" | "off_duty";
};

type FilterTab = "all" | "active" | "inactive" | "available" | "on_duty" | "off_duty";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "inactive",  label: "Inactive" },
  { key: "available", label: "Available" },
  { key: "on_duty",   label: "On Duty" },
  { key: "off_duty",  label: "Off Duty" },
];

const AVAIL_LABEL: Record<string, string> = {
  available: "Available",
  on_duty:   "On Duty",
  off_duty:  "Off Duty",
};

const AVAIL_STYLE: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700",
  on_duty:   "bg-blue-50 text-blue-700",
  off_duty:  "bg-amber-50 text-amber-700",
};

const AVAIL_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  on_duty:   "bg-blue-500",
  off_duty:  "bg-amber-400",
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function ProviderDriversPage() {
  const searchParams = useSearchParams();
  const [drivers, setDrivers]           = useState<Driver[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [viewOpen, setViewOpen]         = useState(false);
  const [assignOpen, setAssignOpen]     = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [activeTab, setActiveTab]       = useState<FilterTab>("all");
  const [search, setSearch]             = useState("");
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid");

  const fetchDrivers = async () => {
    try {
      setError(null);
      const data = await DriverService.getAllDrivers();
      setDrivers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); }, []);

  // Auto-open the add-driver modal when navigated with ?action=add
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setSelectedDriver(null);
      setModalOpen(true);
    }
  }, [searchParams]);

  const handleAddDriver    = () => { setSelectedDriver(null); setModalOpen(true); };
  const handleViewDriver   = (d: Driver) => { setSelectedDriver(d); setViewOpen(true); };
  const handleEditDriver   = (d: Driver) => { setSelectedDriver(d); setModalOpen(true); };
  const handleAssignDriver = (d: Driver) => { setSelectedDriver(d); setAssignOpen(true); };

  const handleAssignSaved = (updated: Driver) => {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setAssignOpen(false);
  };

  const handleSave = async (formData: {
    name: string; phone: string; licenseType: string;
    licenseNumber: string; licenseExpiry: string;
    primaryZone: string; isActive: boolean; availability: string;
  }) => {
    try {
      if (selectedDriver) {
        const updated = await DriverService.updateDriver(selectedDriver.id, {
          full_name:       formData.name,
          phone_number:    formData.phone,
          license_type:    formData.licenseType,
          license_number:  formData.licenseNumber,
          license_expiry:  formData.licenseExpiry || null,
          primary_zone:    formData.primaryZone || null,
          is_active:       formData.isActive,
          availability:    formData.availability as Driver["availability"],
        });
        setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const created = await DriverService.createDriver({
          full_name:       formData.name,
          phone_number:    formData.phone,
          license_type:    formData.licenseType,
          license_number:  formData.licenseNumber,
          license_expiry:  formData.licenseExpiry || null,
          primary_zone:    formData.primaryZone || null,
          is_active:       formData.isActive,
          availability:    formData.availability as Driver["availability"],
        });
        setDrivers((prev) => [created, ...prev]);
      }
      window.dispatchEvent(new Event("navcount:refresh"));
      setModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save driver");
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: drivers.length, active: 0, inactive: 0, available: 0, on_duty: 0, off_duty: 0 };
    drivers.forEach((d) => {
      if (d.is_active) {
        counts.active++;
        if (d.availability in counts) counts[d.availability as FilterTab]++;
      } else {
        counts.inactive++;
      }
    });
    return counts;
  }, [drivers]);

  const filtered = useMemo(() => {
    let list =
      activeTab === "all"      ? drivers :
      activeTab === "active"   ? drivers.filter((d) => d.is_active) :
      activeTab === "inactive" ? drivers.filter((d) => !d.is_active) :
      drivers.filter((d) => d.is_active && d.availability === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.full_name.toLowerCase().includes(q) || d.phone_number.includes(q)
      );
    }
    return list;
  }, [drivers, activeTab, search]);

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-4 sm:px-8 py-4 sm:py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Drivers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your fleet drivers, their vehicle details, and availability status.
            </p>
          </div>
          <button
            onClick={handleAddDriver}
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
            Add Driver
          </button>
        </div>

        {/* Search + filter tabs + view toggle */}
        {!loading && !error && (
          <div className="px-4 sm:px-8 pt-5 pb-4 space-y-2.5">
            {/* Row 1: Search */}
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Row 2: Tabs + view toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                {TABS.map((tab, i) => (
                  <React.Fragment key={tab.key}>
                    {i === 3 && <span className="mx-1 h-4 w-px bg-gray-200 hidden sm:block shrink-0" />}
                    <button
                      onClick={() => setActiveTab(tab.key)}
                      style={activeTab === tab.key ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
                        activeTab === tab.key ? "" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {tab.label}
                      {tabCounts[tab.key] > 0 && (
                        <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "opacity-60" : "text-gray-400"}`}>
                          {tabCounts[tab.key]}
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                ))}
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
                  onClick={() => setViewMode("list")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading drivers...</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-sm font-medium text-red-600">Failed to load drivers</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDrivers}>Try again</Button>
          </div>

        ) : drivers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No drivers yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  You haven&apos;t added any drivers to your fleet. Add your first driver to start managing assignments and availability.
                </p>
              </div>
              <Button onClick={handleAddDriver} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                <Plus className="h-4 w-4" />
                Add your first driver
              </Button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No drivers found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : viewMode === "list" ? (
          /* ── Table view ── */
          <div className="px-4 sm:px-8 pb-8 overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200">
                  {["DRIVER", "STATUS", "AVAILABILITY", "LICENSE", "ZONE", "VEHICLE", "ACTIONS"].map((h) => (
                    <th key={h} className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 first:pl-0 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Driver */}
                    <td className="py-3.5 pr-4">
                      <button onClick={() => handleViewDriver(driver)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
                        <div className={`h-9 w-9 shrink-0 rounded-full ${avatarColor(driver.id)} text-white text-xs font-bold flex items-center justify-center`}>
                          {getInitials(driver.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{driver.full_name}</p>
                          <p className="text-xs text-gray-400">{driver.phone_number}</p>
                        </div>
                      </button>
                    </td>
                    {/* Status */}
                    <td className="py-3.5 pr-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${driver.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {driver.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {/* Availability */}
                    <td className="py-3.5 pr-4">
                      {driver.is_active ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${AVAIL_STYLE[driver.availability] ?? "bg-gray-100 text-gray-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${AVAIL_DOT[driver.availability] ?? "bg-gray-400"}`} />
                          {AVAIL_LABEL[driver.availability] ?? driver.availability}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    {/* License */}
                    <td className="py-3.5 pr-4">
                      <p className="text-xs text-gray-500 mb-1">{driver.license_number}</p>
                      <div className="flex flex-wrap gap-1">
                        {driver.license_type
                          ? driver.license_type.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                              <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{c}</span>
                            ))
                          : <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    {/* Zone */}
                    <td className="py-3.5 pr-4 text-sm text-gray-700 whitespace-nowrap">
                      {driver.primary_zone ?? <span className="text-gray-300">—</span>}
                    </td>
                    {/* Vehicle */}
                    <td className="py-3.5 pr-4 text-sm whitespace-nowrap">
                      {driver.assigned_vehicle ? (
                        <span className="font-medium text-gray-800">
                          {driver.assigned_vehicle.plate_number}
                          <span className="ml-1 text-xs text-gray-400 capitalize font-normal">({driver.assigned_vehicle.vehicle_type})</span>
                        </span>
                      ) : <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    {/* Actions — icons only */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => handleViewDriver(driver)} title="View"
                          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleEditDriver(driver)} title="Edit"
                          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAssignDriver(driver)}
                          title={driver.availability === "on_duty" ? "Assigned" : "Assign vehicle"}
                          className={`p-1.5 rounded transition-colors ${
                            driver.availability === "on_duty"
                              ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {driver.availability === "on_duty"
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <Plus className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : (
          /* ── Card / Grid view ── */
          <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((driver) => (
              <div
                key={driver.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Header */}
                <div className="relative px-5 pt-4 pb-3">
                  <button
                    onClick={() => handleEditDriver(driver)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    title="Edit driver"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-3 pr-8">
                    <div className={`h-11 w-11 shrink-0 rounded-full ${avatarColor(driver.id)} text-white text-sm font-bold flex items-center justify-center`}>
                      {getInitials(driver.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate leading-snug">{driver.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{driver.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${driver.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {driver.is_active ? "Active" : "Inactive"}
                    </span>
                    {driver.is_active && (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${AVAIL_STYLE[driver.availability] ?? "bg-gray-100 text-gray-500"}`}>
                        {AVAIL_LABEL[driver.availability] ?? driver.availability}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="border-t px-5 py-3 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{driver.license_number}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className={driver.primary_zone ? "text-gray-700" : "text-gray-400"}>
                      {driver.primary_zone ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {driver.license_type
                        ? driver.license_type.split(",").map((cls) => cls.trim()).filter(Boolean).map((cls) => (
                            <span key={cls} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{cls}</span>
                          ))
                        : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {driver.assigned_vehicle ? (
                      <span>
                        Vehicle:{" "}
                        <span className="font-semibold text-gray-800">{driver.assigned_vehicle.plate_number}</span>
                        <span className="text-gray-400 ml-1 capitalize">({driver.assigned_vehicle.vehicle_type})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No vehicle assigned</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="border-t grid grid-cols-3 divide-x">
                  {[
                    { label: "DELIVERIES", value: "—" },
                    { label: "RATING",     value: "—" },
                    { label: "ZONE",       value: driver.primary_zone ?? "—" },
                  ].map((s) => (
                    <div key={s.label} className="px-3 py-3 text-center">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{s.label}</p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="border-t grid grid-cols-2 gap-3 p-3">
                  <button
                    onClick={() => handleViewDriver(driver)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  {driver.availability === "on_duty" ? (
                    <button
                      onClick={() => handleAssignDriver(driver)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-blue-300 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Assigned
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssignDriver(driver)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500 py-2 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Assign
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DriverViewModal
        driver={selectedDriver}
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        onEdit={() => handleEditDriver(selectedDriver!)}
      />

      <DriverModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        driver={selectedDriver}
      />

      <DriverAssignModal
        driver={selectedDriver}
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSaved={handleAssignSaved}
      />
    </>
  );
}
