"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

type DriverLike = {
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  license_type?: string | null;
  vehicleType?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  nationalId?: string | null;
  is_active?: boolean | null;
  availability?: string | null;
  primary_zone?: string | null;
};

type DriverFormData = {
  name: string;
  email: string;
  phone: string;
  licenseType: string;
  licenseNumber: string;
  licenseExpiry: string;
  primaryZone: string;
  isActive: boolean;
  availability: string;
};

type DriverModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DriverFormData) => void;
  driver?: DriverLike | null;
};

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

const defaults: DriverFormData = {
  name:          "",
  email:         "",
  phone:         "",
  licenseType:   "",
  licenseNumber: "",
  licenseExpiry: "",
  primaryZone:   "",
  isActive:      true,
  availability:  "available",
};

export default function DriverModal({ isOpen, onClose, onSave, driver }: DriverModalProps) {
  const isEditMode = !!driver;
  const [formData, setFormData]           = useState<DriverFormData>(defaults);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classError, setClassError]       = useState(false);

  useEffect(() => {
    if (driver && isOpen) {
      const rawType = driver.license_type || driver.vehicleType || "";
      const classes = rawType ? rawType.split(",").map((s) => s.trim()).filter(Boolean) : [];
      setSelectedClasses(classes);
      setFormData({
        name:          driver.full_name || driver.name || "",
        email:         driver.email || "",
        phone:         driver.phone_number || driver.phone || "",
        licenseType:   rawType,
        licenseNumber: driver.license_number || driver.nationalId || "",
        licenseExpiry: driver.license_expiry || "",
        primaryZone:   driver.primary_zone || "",
        isActive:      driver.is_active !== false,
        availability:  driver.availability || "available",
      });
      setClassError(false);
    } else if (!driver) {
      setSelectedClasses([]);
      setFormData(defaults);
      setClassError(false);
    }
  }, [driver, isOpen]);

  const toggleClass = (value: string) => {
    setSelectedClasses((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
    setClassError(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedClasses.length === 0) { setClassError(true); return; }
    onSave({ ...formData, licenseType: selectedClasses.join(",") });
    onClose();
    setFormData(defaults);
    setSelectedClasses([]);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[1000] max-h-[90vh] w-[90%] max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-8 py-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isEditMode ? "Edit Driver" : "Add Driver"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isEditMode ? "Update driver details and manage status." : "Register a new driver to your fleet."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(90vh-180px)] overflow-y-auto px-8 py-6 space-y-5">

            {/* Row 1: Full Name + Phone */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter full name"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <PhoneInput
                  placeholder="+254 7XX XXX XXX"
                  defaultCountry="ke"
                  value={formData.phone}
                  onChange={(value) => setFormData((f) => ({ ...f, phone: value }))}
                  required
                />
              </div>
            </div>

            {/* Row 2: Email */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g., driver@example.com"
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
              />
            </div>

            {/* License Class */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                License Class <span className="text-red-600">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span>
              </label>
              {classError && (
                <p className="mb-2 text-xs text-red-500">Please select at least one license class.</p>
              )}
              <div className="rounded-lg border border-gray-200 p-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto">
                {LICENSE_CLASSES.map((lc) => {
                  const checked = selectedClasses.includes(lc.value);
                  return (
                    <label
                      key={lc.value}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer transition-colors text-sm ${
                        checked ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleClass(lc.value)}
                        className="accent-emerald-700 h-3.5 w-3.5 shrink-0"
                      />
                      <span className="leading-tight">{lc.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Row 3: License Number + License Expiry */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  License Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData((f) => ({ ...f, licenseNumber: e.target.value }))}
                  placeholder="Enter license number"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  License Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.licenseExpiry}
                  onChange={(e) => setFormData((f) => ({ ...f, licenseExpiry: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Row 4: Primary Zone */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Primary Zone <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.primaryZone}
                onChange={(e) => setFormData((f) => ({ ...f, primaryZone: e.target.value }))}
                placeholder="e.g., Westlands, Kilimani"
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
              />
            </div>

            {/* Row 5: Status + Driver Availability */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Status <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.isActive ? "active" : "inactive"}
                  onChange={(e) => {
                    const active = e.target.value === "active";
                    setFormData((f) => ({
                      ...f,
                      isActive: active,
                      availability: active ? f.availability : "off_duty",
                    }));
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className={`mb-1.5 block text-sm font-semibold ${formData.isActive ? "text-gray-700" : "text-gray-400"}`}>
                  Driver Availability <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.availability}
                  onChange={(e) => setFormData((f) => ({ ...f, availability: e.target.value }))}
                  disabled={!formData.isActive}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                >
                  <option value="available">Available</option>
                  <option value="on_duty">On Duty</option>
                  <option value="off_duty">Off Duty</option>
                </select>
                {!formData.isActive && (
                  <p className="mt-1 text-xs text-gray-400">Not applicable for inactive drivers</p>
                )}
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 20px", fontSize: 14, fontWeight: 600,
                color: "#162318", backgroundColor: "#CDF782",
                border: "none", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
            >
              {isEditMode ? "Update Driver" : "Add Driver"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
