"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type DriverLike = {
  full_name?: string | null;
  name?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  license_type?: string | null;
  vehicleType?: string | null;
  license_number?: string | null;
  nationalId?: string | null;
  status?: string | null;
  primary_zone?: string | null;
};

type DriverFormData = {
  name: string;
  phone: string;
  licenseType: string;
  nationalId: string;
  primaryZone: string;
  status: string;
  suspendReason?: string;
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
  name: "",
  phone: "",
  licenseType: "",
  nationalId: "",
  primaryZone: "",
  status: "active",
};

export default function DriverModal({
  isOpen,
  onClose,
  onSave,
  driver,
}: DriverModalProps) {
  const isEditMode = !!driver;
  const [formData, setFormData] = useState<DriverFormData>(defaults);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (driver && isOpen) {
      const rawType = driver.license_type || driver.vehicleType || "";
      const classes = rawType ? rawType.split(",").map((s) => s.trim()).filter(Boolean) : [];
      setSelectedClasses(classes);
      setFormData({
        name: driver.full_name || driver.name || "",
        phone: driver.phone_number || driver.phone || "",
        licenseType: rawType,
        nationalId: driver.license_number || driver.nationalId || "",
        primaryZone: driver.primary_zone || "",
        status: driver.status || "active",
      });
      setShowSuspend(false);
      setSuspendReason("");
    } else if (!driver) {
      setSelectedClasses([]);
      setFormData(defaults);
      setShowSuspend(false);
      setSuspendReason("");
    }
  }, [driver, isOpen]);

  const toggleClass = (value: string) => {
    setSelectedClasses((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedClasses.length === 0) return;
    onSave({ ...formData, licenseType: selectedClasses.join(",") });
    onClose();
    setFormData(defaults);
    setSelectedClasses([]);
  };

  const handleSuspend = () => {
    if (!suspendReason.trim()) {
      alert("Please provide a reason for suspension");
      return;
    }
    setFormData((prev) => ({ ...prev, status: "suspended", suspendReason }));
    setShowSuspend(false);
    setSuspendReason("");
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[999] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[1000] max-h-[90vh] w-[90%] max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-8 py-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              {isEditMode ? "Edit Driver" : "Add Driver"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isEditMode
                ? "Update driver details and manage status."
                : "Register a new driver to your fleet."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(90vh-180px)] overflow-y-auto px-8 py-8">
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+254 712 345 678"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                License Class <span className="text-red-600">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span>
              </label>
              {selectedClasses.length === 0 && (
                <p className="mb-2 text-xs text-red-500">Please select at least one license class.</p>
              )}
              <div className="rounded-lg border border-gray-200 p-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-48 overflow-y-auto">
                {LICENSE_CLASSES.map((lc) => {
                  const checked = selectedClasses.includes(lc.value);
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
                        onChange={() => toggleClass(lc.value)}
                        className="accent-emerald-700 h-3.5 w-3.5 shrink-0"
                      />
                      <span className="leading-tight">{lc.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              className={`mb-6 grid grid-cols-1 gap-6 ${
                isEditMode ? "md:grid-cols-2" : ""
              }`}
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  License Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="nationalId"
                  value={formData.nationalId}
                  onChange={handleChange}
                  placeholder="Enter license number"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>

              {isEditMode ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    disabled={formData.status === "suspended"}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    <option value="available">Available</option>
                    <option value="on_duty">On Duty</option>
                    <option value="off_duty">Off Duty</option>
                    {formData.status === "suspended" ? (
                      <option value="suspended">Suspended</option>
                    ) : null}
                  </select>
                  {formData.status === "suspended" ? (
                    <p className="mt-1 text-xs text-red-600">
                      Suspended drivers must be reactivated before changing
                      status.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Primary Zone <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="primaryZone"
                value={formData.primaryZone}
                onChange={handleChange}
                placeholder="e.g., Westlands, Kilimani"
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700"
              />
            </div>

            {isEditMode && formData.status !== "suspended" ? (
              <div className="mt-1 rounded-lg border border-red-200 bg-red-50/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-red-600">
                      Suspend Driver
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      Driver will be blocked from all assignments.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSuspend(!showSuspend)}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    {showSuspend ? "Cancel" : "Suspend"}
                  </button>
                </div>

                {showSuspend ? (
                  <div className="mt-3 border-t border-red-200 pt-3">
                    <label className="mb-2 block text-sm font-semibold text-red-600">
                      Reason for suspension <span>*</span>
                    </label>
                    <input
                      type="text"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="e.g. Policy violation, misconduct..."
                      className="w-full rounded-lg border-2 border-red-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-red-500"
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSuspend}
                        className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                      >
                        Confirm Suspension
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isEditMode && formData.status === "suspended" ? (
              <div className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">
                      Reactivate Driver
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      Restore this driver to active status.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, status: "available" }))
                    }
                    className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                  >
                    Reactivate
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t px-8 py-6">
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
