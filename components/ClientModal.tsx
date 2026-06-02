"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Database } from "@/lib/supabase";

type Client = Database["public"]["Tables"]["partner_clients"]["Row"];

type ClientFormData = {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  area: string;
  note: string;
  status: "active" | "inactive";
};

type ClientModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ClientFormData) => void;
  client?: Client | null;
  saving?: boolean;
};

const defaults: ClientFormData = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  area: "",
  note: "",
  status: "active",
};

export default function ClientModal({
  isOpen,
  onClose,
  onSave,
  client,
  saving = false,
}: ClientModalProps) {
  const isEditMode = !!client;
  const [formData, setFormData] = useState<ClientFormData>(defaults);

  useEffect(() => {
    if (client && isOpen) {
      setFormData({
        company_name: client.company_name,
        contact_name: client.contact_name,
        phone: client.phone,
        email: client.email ?? "",
        area: client.area ?? "",
        note: client.note ?? "",
        status: client.status,
      });
    } else if (!client) {
      setFormData(defaults);
    }
  }, [client, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(formData);
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
        className="fixed left-1/2 top-1/2 z-[1000] max-h-[90vh] w-[90%] max-w-[600px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-8 py-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isEditMode ? "Edit Client" : "Add Client"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isEditMode
                ? "Update client details."
                : "Add a new business or contact you deliver for."}
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
          <div className="max-h-[calc(90vh-180px)] overflow-y-auto px-8 py-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Company Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  placeholder="e.g. Baobab Bakehouse"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Contact Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="e.g. Zuri Kamau"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+254 755 400 004"
                  required
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="orders@example.co.ke"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Area
                </label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  placeholder="e.g. Karen, Nairobi"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                />
              </div>

              {isEditMode && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Note
              </label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Daily bakery runs, 6am drops"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-emerald-700 resize-none"
              />
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
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : isEditMode ? "Update Client" : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
