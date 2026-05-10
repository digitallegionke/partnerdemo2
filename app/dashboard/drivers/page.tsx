"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, FileText, MapPin, Truck, Eye, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DriverModal from "@/components/DriverModal";
import DriverViewModal from "@/components/DriverViewModal";
import DriverAssignModal from "@/components/DriverAssignModal";
import { DriverService } from "@/lib/services/drivers";
import type { Database } from "@/lib/supabase";

type Driver = Database["public"]["Tables"]["partner_drivers"]["Row"] & {
  assigned_vehicle?: { plate_number: string; vehicle_type: string; assigned_from: string } | null;
};

type FilterTab = "all" | "active" | "on_trip" | "off_duty" | "inactive";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "active",   label: "Available" },
  { key: "on_trip",  label: "Assigned" },
  { key: "off_duty", label: "On Leave" },
  { key: "inactive", label: "Inactive" },
];

const STATUS_LABEL: Record<string, string> = {
  active:   "Available",
  on_trip:  "Assigned",
  off_duty: "On Leave",
  inactive: "Inactive",
};

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700",
  on_trip:  "bg-blue-50 text-blue-700",
  off_duty: "bg-amber-50 text-amber-700",
  inactive: "bg-gray-100 text-gray-500",
};

const STATUS_DOT: Record<string, string> = {
  active:   "bg-emerald-500",
  on_trip:  "bg-blue-500",
  off_duty: "bg-amber-400",
  inactive: "bg-gray-400",
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
    nationalId: string; primaryZone: string; status: string; suspendReason?: string;
  }) => {
    try {
      if (selectedDriver) {
        const updated = await DriverService.updateDriver(selectedDriver.id, {
          full_name: formData.name, phone_number: formData.phone,
          license_type: formData.licenseType, license_number: formData.nationalId,
          primary_zone: formData.primaryZone || null,
          status: formData.status as Driver["status"],
        });
        setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const created = await DriverService.createDriver({
          full_name: formData.name, phone_number: formData.phone,
          license_type: formData.licenseType, license_number: formData.nationalId,
          primary_zone: formData.primaryZone || null,
          status: "active",
        });
        setDrivers((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save driver");
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: drivers.length, active: 0, on_trip: 0, off_duty: 0, inactive: 0 };
    drivers.forEach((d) => { if (d.status in counts) counts[d.status as FilterTab]++; });
    return counts;
  }, [drivers]);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? drivers : drivers.filter((d) => d.status === activeTab);
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
        <div className="flex items-center justify-between gap-4 border-b px-8 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Drivers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your fleet drivers, their vehicle details, and availability status.
            </p>
          </div>
          <Button onClick={handleAddDriver} className="shrink-0 gap-2 bg-emerald-700 hover:bg-emerald-800">
            <Plus className="h-4 w-4" />
            Add Driver
          </Button>
        </div>


        {/* Search + filter tabs */}
        {!loading && !error && (
          <div className="px-8 pt-5 pb-4 space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or phone..."
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

        ) : (
          /* Driver cards */
          <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((driver) => (
              <div
                key={driver.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Header — avatar · name · phone | status + pencil */}
                <div className="px-5 py-4 flex items-center gap-3">
                  <div
                    className={`h-12 w-12 shrink-0 rounded-full ${avatarColor(driver.id)} text-white text-base font-bold flex items-center justify-center`}
                  >
                    {getInitials(driver.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-900 leading-snug">
                      {driver.full_name}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">{driver.phone_number}</p>
                  </div>
                  {/* Right: status badge + pencil on the same line */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[driver.status]}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[driver.status]}`} />
                      {STATUS_LABEL[driver.status] ?? driver.status}
                    </span>
                    <button
                      onClick={() => handleEditDriver(driver)}
                      className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                      title="Edit driver"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details — license number · zone · license class · assigned vehicle */}
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
                            <span
                              key={cls}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700"
                            >
                              {cls}
                            </span>
                          ))
                        : <span className="text-gray-400">—</span>
                      }
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {driver.assigned_vehicle ? (
                      <span>
                        Vehicle:{" "}
                        <span className="font-semibold text-gray-800">
                          {driver.assigned_vehicle.plate_number}
                        </span>
                        <span className="text-gray-400 ml-1 capitalize">
                          ({driver.assigned_vehicle.vehicle_type})
                        </span>
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
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                        {s.label}
                      </p>
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
                  {driver.status === "on_trip" ? (
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
