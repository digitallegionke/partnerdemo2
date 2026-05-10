"use client";

import {
  X, FileText, Fuel, Gauge, Package, User,
  CalendarDays, ShieldCheck, Truck, Bike, AlertCircle, Trash2, Palette, BadgeCheck, ClipboardCheck,
} from "lucide-react";

type FleetVehicle = {
  id: number;
  plate_number: string;
  vehicle_type: string;
  status: string;
  vin?: string | null;
  fuel_type?: string | null;
  capacity_kg?: number | null;
  odometer_km?: number | null;
  allowed_license?: string | null;
  last_service_date?: string | null;
  insurance_expiry?: string | null;
  inspection_expiry?: string | null;
  notes?: string | null;
  assigned_driver_name?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
};

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

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  motorbike: "Motorbike",
  bicycle:   "Bicycle",
  car:       "Car",
  van:       "Van",
  truck:     "Truck",
  other:     "Other",
};

function VehicleIcon({ type, className }: { type: string; className?: string }) {
  if (type === "motorbike" || type === "bicycle") return <Bike className={className} />;
  if (type === "van" || type === "truck") return <Truck className={className} />;
  return <Package className={className} />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

type Props = {
  vehicle: FleetVehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

type DetailRowProps = {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
};

function DetailRow({ icon, label, children }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-gray-400 mt-0.5">{icon}</span>
      <span className="text-gray-500 w-36 shrink-0 text-sm">{label}</span>
      <span className="text-sm font-medium text-gray-900">{children}</span>
    </div>
  );
}

export default function FleetViewModal({ vehicle, isOpen, onClose, onEdit, onDelete }: Props) {
  if (!isOpen || !vehicle) return null;

  const licenses = vehicle.allowed_license
    ? vehicle.allowed_license.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

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
            <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-emerald-600">
              <VehicleIcon type={vehicle.vehicle_type} className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{vehicle.plate_number}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {VEHICLE_TYPE_LABEL[vehicle.vehicle_type] ?? vehicle.vehicle_type}
                {vehicle.make ? ` · ${vehicle.make}` : ""}
                {vehicle.model ? ` ${vehicle.model}` : ""}
                {vehicle.year ? ` (${vehicle.year})` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[vehicle.status] ?? "bg-gray-100 text-gray-500"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[vehicle.status] ?? "bg-gray-400"}`} />
              {STATUS_LABEL[vehicle.status] ?? vehicle.status}
            </span>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-3.5">
          {vehicle.vin && (
            <DetailRow icon={<FileText className="h-4 w-4" />} label="VIN">
              {vehicle.vin}
            </DetailRow>
          )}

          <DetailRow icon={<Fuel className="h-4 w-4" />} label="Fuel Type">
            {vehicle.fuel_type
              ? <span className="capitalize">{vehicle.fuel_type}</span>
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          <DetailRow icon={<Palette className="h-4 w-4" />} label="Color">
            {vehicle.color
              ? vehicle.color
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          <DetailRow icon={<Package className="h-4 w-4" />} label="Capacity">
            {vehicle.capacity_kg != null
              ? `${vehicle.capacity_kg} kg`
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          <DetailRow icon={<Gauge className="h-4 w-4" />} label="Odometer">
            {vehicle.odometer_km != null
              ? `${vehicle.odometer_km.toLocaleString()} km`
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          <DetailRow icon={<User className="h-4 w-4" />} label="Assigned Driver">
            {vehicle.assigned_driver_name
              ? vehicle.assigned_driver_name
              : <span className="text-gray-400 font-normal italic">Not assigned</span>
            }
          </DetailRow>

          <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Last Service">
            {vehicle.last_service_date
              ? formatDate(vehicle.last_service_date)
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          <DetailRow icon={<BadgeCheck className="h-4 w-4" />} label="Insurance Expiry">
            {vehicle.insurance_expiry
              ? formatDate(vehicle.insurance_expiry)
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          <DetailRow icon={<ClipboardCheck className="h-4 w-4" />} label="Inspection Expiry">
            {vehicle.inspection_expiry
              ? formatDate(vehicle.inspection_expiry)
              : <span className="text-gray-400 font-normal">—</span>
            }
          </DetailRow>

          {/* Allowed Licenses */}
          <div className="flex items-start gap-3">
            <span className="shrink-0 text-gray-400 mt-0.5"><ShieldCheck className="h-4 w-4" /></span>
            <span className="text-gray-500 w-36 shrink-0 text-sm">Allowed License</span>
            {licenses.length > 0
              ? (
                <div className="flex flex-wrap gap-1">
                  {licenses.map((c) => (
                    <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">
                      {c}
                    </span>
                  ))}
                </div>
              )
              : <span className="text-sm text-gray-400 font-normal">—</span>
            }
          </div>

          {vehicle.notes && (
            <DetailRow icon={<AlertCircle className="h-4 w-4" />} label="Notes">
              <span className="text-gray-600 font-normal">{vehicle.notes}</span>
            </DetailRow>
          )}
        </div>

        {/* Footer */}
        <div className="border-t flex gap-3 px-6 py-4">
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="flex-1 rounded-lg border border-emerald-500 py-2.5 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
          >
            Edit Vehicle
          </button>
        </div>
      </div>
    </>
  );
}
