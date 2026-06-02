"use client";

import { X, Pencil, Phone, Mail, MapPin, FileText, CalendarDays } from "lucide-react";
import type { Database } from "@/lib/supabase";

type Client = Database["public"]["Tables"]["partner_clients"]["Row"];

const AVATAR_COLORS = [
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-blue-100",    text: "text-blue-700"    },
  { bg: "bg-violet-100",  text: "text-violet-700"  },
  { bg: "bg-rose-100",    text: "text-rose-700"    },
  { bg: "bg-amber-100",   text: "text-amber-700"   },
  { bg: "bg-cyan-100",    text: "text-cyan-700"    },
  { bg: "bg-indigo-100",  text: "text-indigo-700"  },
  { bg: "bg-teal-100",    text: "text-teal-700"    },
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function clientCode(id: number) {
  return `cl-${String(id).padStart(3, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Props = {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
};

export default function ClientViewModal({ client: c, isOpen, onClose, onEdit }: Props) {
  if (!isOpen || !c) return null;

  const colors = avatarColor(c.id);

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
        className="fixed left-1/2 top-1/2 z-[1000] w-[90%] max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div
              className={`h-14 w-14 shrink-0 rounded-full ${colors.bg} ${colors.text} text-lg font-bold flex items-center justify-center`}
            >
              {getInitials(c.company_name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">{clientCode(c.id)}</span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    c.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      c.status === "active" ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  {c.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-gray-900 leading-tight">
                {c.company_name}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">{c.contact_name}</p>
            </div>
          </div>

          {/* Edit + Close icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { onClose(); onEdit(); }}
              className="rounded-lg p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              title="Edit client"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-4">
          <ViewRow
            icon={<Phone className="h-4 w-4 text-gray-400 shrink-0" />}
            label="Phone"
            value={c.phone}
          />
          <ViewRow
            icon={<Mail className="h-4 w-4 text-gray-400 shrink-0" />}
            label="Email"
            value={c.email}
          />
          <ViewRow
            icon={<MapPin className="h-4 w-4 text-gray-400 shrink-0" />}
            label="Area"
            value={c.area}
          />
          {c.note && (
            <ViewRow
              icon={<FileText className="h-4 w-4 text-gray-400 shrink-0" />}
              label="Note"
              value={c.note}
              italic
            />
          )}
          <div className="border-t border-gray-100 pt-4">
            <ViewRow
              icon={<CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />}
              label="Client since"
              value={formatDate(c.created_at)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 flex gap-3 px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="flex-1 rounded-xl border border-emerald-400 py-2.5 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
          >
            Edit Client
          </button>
        </div>
      </div>
    </>
  );
}

function ViewRow({
  icon,
  label,
  value,
  italic = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  italic?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {icon}
      <span className="text-gray-500 w-24 shrink-0">{label}</span>
      <span
        className={`font-medium text-gray-900 min-w-0 break-words ${
          italic ? "italic font-normal text-gray-600" : ""
        } ${!value ? "text-gray-400 font-normal not-italic" : ""}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}
