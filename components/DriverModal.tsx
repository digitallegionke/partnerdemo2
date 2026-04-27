"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type DriverLike = {
  full_name?: string;
  name?: string;
  phone_number?: string;
  phone?: string;
  vehicle_type?: string;
  vehicleType?: string;
  vehicle_plate?: string;
  vehiclePlate?: string;
  license_number?: string;
  nationalId?: string;
  status?: string;
};

type DriverFormData = {
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  nationalId: string;
  status: string;
  suspendReason?: string;
};

type DriverModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DriverFormData) => void;
  driver?: DriverLike | null;
};

const defaults: DriverFormData = {
  name: "",
  phone: "",
  vehicleType: "motorcycle",
  vehiclePlate: "",
  nationalId: "",
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
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (driver && isOpen) {
      setFormData({
        name: driver.full_name || driver.name || "",
        phone: driver.phone_number || driver.phone || "",
        vehicleType: driver.vehicle_type || driver.vehicleType || "motorcycle",
        vehiclePlate: driver.vehicle_plate || driver.vehiclePlate || "",
        nationalId: driver.license_number || driver.nationalId || "",
        status: driver.status || "active",
      });
      setShowSuspend(false);
      setSuspendReason("");
    } else if (!driver) {
      setFormData(defaults);
      setShowSuspend(false);
      setSuspendReason("");
    }
  }, [driver, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(formData);
    onClose();
    setFormData(defaults);
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

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Vehicle Type <span className="text-red-600">*</span>
                </label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700"
                >
                  <option value="motorcycle">Motorcycle</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                  <option value="truck">Truck</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Vehicle Plate <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="vehiclePlate"
                  value={formData.vehiclePlate}
                  onChange={handleChange}
                  placeholder="KCA 123A"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
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
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              {isEditMode ? "Update Driver" : "Add Driver"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
