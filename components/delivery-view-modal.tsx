"use client";

import { useState } from "react";
import {
  X,
  Pencil,
  User,
  Phone,
  MapPin,
  Copy,
  Link2,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase";

type PartnerDelivery = Database["public"]["Tables"]["partner_deliveries"]["Row"];

type DisplayStatus =
  | "awaiting_approval"
  | "pending"
  | "rejected"
  | "out_for_delivery"
  | "cancelled"
  | "in_transit"
  | "delivered"
  | "failed";

export type ViewableDelivery = PartnerDelivery & {
  displayStatus: DisplayStatus;
  driverName: string;
  distanceKm: number | null;
};

const STATUS_BADGE: Record<DisplayStatus, { label: string; cls: string; dot: string }> = {
  awaiting_approval: { label: "Awaiting Approval", cls: "bg-blue-50 text-blue-700",       dot: "bg-blue-500"      },
  pending:           { label: "Pending",           cls: "bg-amber-50 text-amber-700",     dot: "bg-amber-400"     },
  rejected:          { label: "Rejected",          cls: "bg-rose-50 text-rose-700",       dot: "bg-rose-500"      },
  out_for_delivery:  { label: "Out for Delivery",  cls: "bg-violet-50 text-violet-700",   dot: "bg-violet-500"    },
  cancelled:         { label: "Cancelled",         cls: "bg-gray-100 text-gray-500",      dot: "bg-gray-400"      },
  in_transit:        { label: "In Transit",        cls: "bg-sky-50 text-sky-700",         dot: "bg-sky-500"       },
  delivered:         { label: "Delivered",         cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500"   },
  failed:            { label: "Failed",            cls: "bg-red-50 text-red-700",         dot: "bg-red-400"       },
};

function deliveryIdLabel(id: number) {
  return `DEL-${String(id).padStart(4, "0")}`;
}

function getTrackingNumber(delivery: PartnerDelivery): string {
  const ts = Math.floor(new Date(delivery.created_at).getTime() / 1000);
  const h = ts.toString(16).padStart(8, "0");
  const idHex = delivery.id.toString(16).padStart(4, "0");
  return `roundi_${h}-${h.slice(0, 4)}-${idHex}-9433-${h}0000`;
}

function isExpress(notes: string | null): boolean {
  return notes?.toLowerCase().includes("priority: express") ?? false;
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-CA");
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function formatValue(value: string | null): string {
  if (!value) return "—";
  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) return value;
  const num = parseFloat(digits);
  if (isNaN(num)) return value;
  return `KES ${num.toLocaleString("en-KE")}`;
}

const SIZE_VOLUMES: Record<string, number> = {
  S: 20 * 7 * 15,
  M: 37 * 18 * 30,
  L: 48 * 23 * 38,
  XL: 40 * 40 * 40,
};

function parseItemsForDisplay(itemStr: string): { name: string; value: string; size: string }[] {
  try {
    const parsed = JSON.parse(itemStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((i) => ({
        name: String(i.name ?? ""),
        value: String(i.value ?? ""),
        size: String(i.size ?? ""),
      }));
    }
  } catch {}
  return [{ name: itemStr, value: "", size: "" }];
}

function computeItemsVolume(itemStr: string): number {
  const items = parseItemsForDisplay(itemStr);
  return items.reduce((sum, i) => sum + (SIZE_VOLUMES[i.size] ?? 0), 0);
}

interface DeliveryViewModalProps {
  open: boolean;
  onClose: () => void;
  onEdit: (delivery: ViewableDelivery) => void;
  delivery: ViewableDelivery | null;
}

export default function DeliveryViewModal({
  open,
  onClose,
  onEdit,
  delivery,
}: DeliveryViewModalProps) {
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!open || !delivery) return null;

  const trackingNumber = getTrackingNumber(delivery);
  const badge = STATUS_BADGE[delivery.displayStatus];
  const express = isExpress(delivery.delivery_notes);

  const copyTracking = async () => {
    await navigator.clipboard.writeText(trackingNumber);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/track?trackingNumber=${encodeURIComponent(trackingNumber)}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Delivery Details - {deliveryIdLabel(delivery.id)}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Complete information about this delivery
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(delivery)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Edit delivery"
              title="Edit delivery"
            >
              <Pencil className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Tracking number card */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-5 py-4">
            <p className="text-xs font-medium text-gray-400 mb-1.5">Tracking Number</p>
            <p className="text-sm font-mono font-bold text-gray-900 break-all leading-relaxed">
              {trackingNumber}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={copyTracking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copiedTracking
                  ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                  : <Copy className="h-3.5 w-3.5" />}
                {copiedTracking ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copiedLink
                  ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                  : <Link2 className="h-3.5 w-3.5" />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Status + priority badges */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
              {badge.label}
            </span>
            {express && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
                <Zap className="h-3 w-3" />
                Express
              </span>
            )}
          </div>

          {/* Two-column info */}
          <div className="grid grid-cols-2 gap-8">
            {/* Customer Info */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Customer Information</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{delivery.customer_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{delivery.phone}</span>
                </div>
                {delivery.pickup_location && (
                  <div className="flex items-start gap-3 text-sm text-gray-700">
                    <MapPin className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Pick Up</p>
                      <p>{delivery.pickup_location}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <MapPin className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Drop Off</p>
                    <p>{delivery.location}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Details */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Delivery Details</p>
              {(() => {
                const parsedItems = parseItemsForDisplay(delivery.item);
                const totalVolume = computeItemsVolume(delivery.item);
                return (
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-gray-400">Items:</p>
                        <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {parsedItems.length} {parsedItems.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {parsedItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {item.size && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                                  {item.size}
                                </span>
                              )}
                              <span className="font-medium text-gray-800 truncate">{item.name}</span>
                            </div>
                            {item.value && (
                              <span className="text-gray-500 shrink-0">
                                KSh {parseFloat(item.value.replace(/[^\d.]/g, "") || "0").toLocaleString("en-KE")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-500 w-24 shrink-0">Value:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatValue(delivery.estimated_value)}
                      </span>
                    </div>
                    {totalVolume > 0 && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-500 w-24 shrink-0">Volume:</span>
                        <span className="text-sm font-medium text-gray-800">
                          {totalVolume.toLocaleString("en-KE")} cm³
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-500 w-24 shrink-0">Scheduled:</span>
                      <span className="text-sm font-medium text-gray-800">
                        {formatScheduled(delivery.drop_time)}
                      </span>
                    </div>
                    {delivery.distanceKm != null && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-500 w-24 shrink-0">Distance:</span>
                        <span className="text-sm font-medium text-gray-800">{delivery.distanceKm} km</span>
                      </div>
                    )}
                    {delivery.weight && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-500 w-24 shrink-0">Weight:</span>
                        <span className="text-sm font-medium text-gray-800">{delivery.weight} kg</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Driver Assignment */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Driver Assignment</p>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                {delivery.driverName === "Unassigned" ? (
                  <span className="text-gray-400 text-base font-medium">—</span>
                ) : (
                  <span className="text-gray-700 text-sm font-semibold">
                    {delivery.driverName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className={`text-sm font-medium ${delivery.driverName === "Unassigned" ? "text-gray-400 italic" : "text-gray-800"}`}>
                {delivery.driverName}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <Button
            onClick={onClose}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
