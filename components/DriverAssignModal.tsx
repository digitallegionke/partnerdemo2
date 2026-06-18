"use client";

import { useEffect, useState } from "react";
import { X, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type Driver = Database["public"]["Tables"]["partner_drivers"]["Row"] & {
  assigned_vehicle?: { plate_number: string; vehicle_type: string; assigned_from: string } | null;
};
type FleetVehicle = Database["public"]["Tables"]["partner_vehicles"]["Row"];

type Props = {
  driver: Driver | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Driver) => void;
};

const STATUS_OPTIONS = [
  { value: "active",    label: "Available" },
  { value: "on_trip",   label: "Assigned" },
  { value: "off_duty",  label: "On Leave" },
  { value: "inactive",  label: "Inactive" },
];

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : "";
}

export default function DriverAssignModal({ driver, isOpen, onClose, onSaved }: Props) {
  const [vehicles, setVehicles]           = useState<FleetVehicle[]>([]);
  const [currentVehicleId, setCurrentVehicleId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [hasIncompatibleVehicles, setHasIncompatibleVehicles] = useState(false);
  const [name, setName]                   = useState("");
  const [phone, setPhone]                 = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [primaryZone, setPrimaryZone]     = useState("");
  const [status, setStatus]               = useState("active");
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !driver) return;

    setName(driver.full_name);
    setPhone(driver.phone_number);
    setLicenseNumber(driver.license_number ?? "");
    setPrimaryZone(driver.primary_zone ?? "");
    setStatus(driver.status ?? "active");
    setError(null);

    const load = async () => {
      setLoading(true);
      try {
        const token = await getAuthHeader();
        const [vehiclesRes, assignRes] = await Promise.all([
          fetch("/api/fleet", { headers: { Authorization: token } }),
          fetch(`/api/drivers/${driver.id}/assign`, { headers: { Authorization: token } }),
        ]);

        const vehicleData: FleetVehicle[] = vehiclesRes.ok ? await vehiclesRes.json() : [];
        const assignData: { vehicle: FleetVehicle | null } = assignRes.ok ? await assignRes.json() : { vehicle: null };

        const currentVehicle = assignData.vehicle;
        setCurrentVehicleId(currentVehicle?.id ?? null);
        setSelectedVehicleId(currentVehicle?.id ?? null);

        const driverLicenses = (driver.license_type ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const isLicenseCompatible = (v: FleetVehicle) => {
          if (!v.allowed_license) return true;
          const required = v.allowed_license.split(",").map((s) => s.trim()).filter(Boolean);
          if (required.length === 0) return true;
          return driverLicenses.some((dl) => required.includes(dl));
        };

        // Available vehicles the driver can be assigned to
        const availablePool = vehicleData.filter(
          (v) => v.status === "available" || v.id === currentVehicle?.id
        );
        const compatible = availablePool.filter(
          (v) => v.id === currentVehicle?.id || isLicenseCompatible(v)
        );

        setHasIncompatibleVehicles(availablePool.length > compatible.length);
        setVehicles(compatible);
      } catch {
        setError("Failed to load vehicles.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, driver]);

  const handleSave = async () => {
    if (!driver) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getAuthHeader();

      // Update driver fields
      const patchRes = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({
          full_name: name,
          phone_number: phone,
          license_number: licenseNumber,
          primary_zone: primaryZone || null,
          status,
        }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update driver");
      }

      // Handle vehicle assignment change
      if (selectedVehicleId !== currentVehicleId) {
        const assignRes = await fetch(`/api/drivers/${driver.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: token },
          body: JSON.stringify({ vehicle_id: selectedVehicleId }),
        });
        if (!assignRes.ok) {
          const err = await assignRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to assign vehicle");
        }
        const updated: Driver = await assignRes.json();
        onSaved(updated);
      } else {
        const updated: Driver = await patchRes.json();
        onSaved(updated);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !driver) return null;

  const vehicleLabel = (v: FleetVehicle) => {
    const parts = [v.plate_number, v.vehicle_type];
    if (v.make) parts.push(v.make);
    return parts.join(" — ");
  };

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[1000] w-[90%] max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Assign Vehicle</h3>
            <p className="text-sm text-gray-500 mt-0.5">Update driver details and vehicle assignment.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Full Name + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* License Number + Primary Zone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">License Number</label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Primary Zone</label>
              <input
                type="text"
                value={primaryZone}
                onChange={(e) => setPrimaryZone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Assign Vehicle */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assign Vehicle</label>
            {loading ? (
              <div className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400">
                Loading vehicles...
              </div>
            ) : (
              <select
                value={selectedVehicleId ?? ""}
                onChange={(e) => setSelectedVehicleId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              >
                <option value="">Unassign</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                    {v.id === currentVehicleId ? " (current)" : ""}
                  </option>
                ))}
              </select>
            )}
            {!loading && vehicles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {hasIncompatibleVehicles
                  ? "No vehicles match this driver's license class(es). Update the driver's licenses or the vehicle's required license in Fleet Registry."
                  : "No available vehicles. Add vehicles in Fleet Registry first."}
              </p>
            )}
            {!loading && vehicles.length === 0 && hasIncompatibleVehicles && (
              <p className="text-xs text-gray-400 mt-0.5">
                Driver licenses: {(driver.license_type ?? "").split(",").map(s => s.trim()).filter(Boolean).join(", ") || "none"}
              </p>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800">
            <Info className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            Only vehicles whose required license class matches this driver&apos;s license(s) are shown. The driver status will update automatically.
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Update Driver"}
          </button>
        </div>
      </div>
    </>
  );
}
