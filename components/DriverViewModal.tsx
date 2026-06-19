"use client";

import { X, FileText, MapPin, Truck, Mail, CalendarDays, ShieldCheck } from "lucide-react";

type Driver = {
  id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  license_number: string;
  license_type: string;
  license_expiry?: string | null;
  primary_zone: string | null;
  is_active: boolean;
  availability: "available" | "on_duty" | "off_duty";
  is_online: boolean;
  created_at: string;
  assigned_vehicle?: {
    plate_number: string;
    vehicle_type: string;
    assigned_from: string;
  } | null;
};

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

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-blue-600", "bg-violet-600",
  "bg-rose-600", "bg-amber-600", "bg-cyan-600",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric", month: "long", year: "numeric",
  });
}

type Props = {
  driver: Driver | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
};

export default function DriverViewModal({ driver, isOpen, onClose, onEdit }: Props) {
  if (!isOpen || !driver) return null;

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[1000] w-[90%] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 shrink-0 rounded-full ${avatarColor(driver.id)} text-white text-lg font-bold flex items-center justify-center`}>
              {getInitials(driver.full_name)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{driver.full_name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{driver.phone_number}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {/* Active / Inactive */}
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${driver.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${driver.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                {driver.is_active ? "Active" : "Inactive"}
              </span>
              <button
                onClick={onClose}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {/* Availability — only when active */}
            {driver.is_active && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${AVAIL_STYLE[driver.availability] ?? "bg-gray-100 text-gray-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${AVAIL_DOT[driver.availability] ?? "bg-gray-400"}`} />
                {AVAIL_LABEL[driver.availability] ?? driver.availability}
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-3.5 text-sm text-gray-700">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-gray-500 w-36 shrink-0">License No.</span>
            <span className="font-medium text-gray-900">{driver.license_number}</span>
          </div>

          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <span className="text-gray-500 w-36 shrink-0">License Class</span>
            <div className="flex flex-wrap gap-1">
              {driver.license_type
                ? driver.license_type.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                    <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">
                      {c}
                    </span>
                  ))
                : <span className="text-gray-400">—</span>
              }
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-gray-500 w-36 shrink-0">License Expiry</span>
            <span className={`font-medium ${driver.license_expiry ? "text-gray-900" : "text-gray-400"}`}>
              {driver.license_expiry ? formatDate(driver.license_expiry) : "—"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-gray-500 w-36 shrink-0">Primary Zone</span>
            <span className={`font-medium ${driver.primary_zone ? "text-gray-900" : "text-gray-400"}`}>
              {driver.primary_zone ?? "—"}
            </span>
          </div>

          {driver.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 w-36 shrink-0">Email</span>
              <span className="font-medium text-gray-900">{driver.email}</span>
            </div>
          )}

          {/* Vehicle assignment */}
          <div className="border-t pt-3.5 space-y-3.5">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-gray-500 w-36 shrink-0">Assigned Vehicle</span>
              {driver.assigned_vehicle ? (
                <span className="font-medium text-gray-900">
                  {driver.assigned_vehicle.plate_number}
                  <span className="ml-1.5 text-xs text-gray-400 capitalize font-normal">
                    ({driver.assigned_vehicle.vehicle_type})
                  </span>
                </span>
              ) : (
                <span className="text-gray-400 italic">No vehicle assigned</span>
              )}
            </div>
            {driver.assigned_vehicle && (
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-gray-500 w-36 shrink-0">Assigned Since</span>
                <span className="font-medium text-gray-900">
                  {formatDate(driver.assigned_vehicle.assigned_from)}
                </span>
              </div>
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

        {/* Joined date */}
        <div className="border-t px-6 py-3">
          <p className="text-xs text-gray-400">Joined {formatDate(driver.created_at)}</p>
        </div>

        {/* Footer */}
        <div className="border-t flex gap-3 px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="flex-1 rounded-lg border border-emerald-500 py-2.5 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
          >
            Edit Driver
          </button>
        </div>
      </div>
    </>
  );
}
