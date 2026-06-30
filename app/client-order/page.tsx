"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  User,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import AddressSearch, { type AddressSelectResult } from "@/components/address-search";

type ProviderInfo = {
  id: number;
  provider_name: string;
  legal_name: string | null;
  city: string | null;
  country: string | null;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CDF782]/60 focus:border-[#162318] transition-colors";

export default function ClientOrderPage() {
  const searchParams = useSearchParams();
  const p = searchParams.get("p") ?? "";

  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [items, setItems] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [orderRef, setOrderRef] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!p) {
      setProviderError("No logistics provider specified in this link.");
      setLoadingProvider(false);
      return;
    }
    fetch(`/api/client-orders?p=${encodeURIComponent(p)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Provider not found");
        return r.json();
      })
      .then((data: ProviderInfo) => setProvider(data))
      .catch(() => setProviderError("This order link is invalid or has expired."))
      .finally(() => setLoadingProvider(false));
  }, [p]);

  const handlePickupSelect = (result: AddressSelectResult) => {
    setPickupLocation(result.display_name);
  };

  const handleDropoffSelect = (result: AddressSelectResult) => {
    setDropoffLocation(result.display_name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) { setFormError("Please enter your name."); return; }
    if (!phone.trim() || phone.length < 7) { setFormError("Please enter a valid phone number."); return; }
    if (!pickupLocation.trim()) { setFormError("Please enter a pickup address."); return; }
    if (!dropoffLocation.trim()) { setFormError("Please enter a drop-off address."); return; }
    if (!items.trim()) { setFormError("Please describe what needs to be delivered."); return; }
    if (!preferredDate) { setFormError("Please select a preferred delivery date."); return; }
    if (!preferredTime) { setFormError("Please select a preferred delivery time."); return; }

    const drop_time = `${preferredDate}T${preferredTime}:00`;

    setSubmitState("submitting");
    try {
      const res = await fetch("/api/client-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: p,
          customer_name: customerName.trim(),
          phone: phone.trim(),
          pickup_location: pickupLocation.trim(),
          location: dropoffLocation.trim(),
          item: items.trim(),
          drop_time,
          delivery_notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit order");
      setOrderRef(data.ref);
      setSubmitState("success");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitState("error");
    }
  };

  // Loading state
  if (loadingProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Provider not found
  if (providerError || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-gray-100 px-6 py-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-base font-semibold text-gray-800">Invalid Link</h2>
          <p className="mt-1 text-sm text-gray-500">{providerError}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitState === "success" && orderRef) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-gray-100 px-6 py-10 text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "#CDF782" }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: "#162318" }} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Order Received!</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your delivery request has been sent to{" "}
            <span className="font-semibold text-gray-700">{provider.provider_name}</span>.
            They will contact you to confirm the details.
          </p>
          <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Reference Number
            </p>
            <p className="mt-1 text-base font-bold tracking-wider text-gray-800">{orderRef}</p>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Please save your reference number for follow-up.
          </p>
          <button
            onClick={() => {
              setSubmitState("idle");
              setOrderRef(null);
              setCustomerName("");
              setPhone("");
              setPickupLocation("");
              setDropoffLocation("");
              setItems("");
              setPreferredDate("");
              setPreferredTime("");
              setNotes("");
              setFormError(null);
            }}
            className="mt-6 text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors"
          >
            Submit another order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#CDF782" }}
          >
            <Package className="h-6 w-6" style={{ color: "#162318" }} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{provider.provider_name}</h1>
          {provider.legal_name && provider.legal_name !== provider.provider_name && (
            <p className="text-sm text-gray-500">{provider.legal_name}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Fill in the form below to request a delivery
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
          <form ref={formRef} onSubmit={handleSubmit} autoComplete="off" className="px-6 py-6 space-y-5">

            {/* Recipient */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  Your Name <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="text"
                autoComplete="off"
                placeholder="Full name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                placeholder="+254 7XX XXX XXX"
                defaultCountry="ke"
                value={phone}
                onChange={(value) => setPhone(value)}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Pickup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  Pickup Address <span className="text-red-500">*</span>
                </span>
              </label>
              <AddressSearch
                value={pickupLocation}
                placeholder="Where should we pick up from?"
                countryCode="ke"
                onSelect={handlePickupSelect}
              />
            </div>

            {/* Drop-off */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#CDF782]" style={{ color: "#162318" }} />
                  Drop-off Address <span className="text-red-500">*</span>
                </span>
              </label>
              <AddressSearch
                value={dropoffLocation}
                placeholder="Where should we deliver to?"
                countryCode="ke"
                onSelect={handleDropoffSelect}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-gray-400" />
                  What are you sending? <span className="text-red-500">*</span>
                </span>
              </label>
              <textarea
                rows={2}
                placeholder="Describe the item(s) — e.g. 3 boxes of electronics, 1 bag of clothes"
                value={items}
                onChange={(e) => setItems(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Preferred date & time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Preferred Date <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Preferred Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                  Additional Notes
                </span>
              </label>
              <textarea
                rows={2}
                placeholder="Any special instructions? (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitState === "submitting"}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: "#CDF782", color: "#162318" }}
            >
              {submitState === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Delivery Request"
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Your details will be shared with {provider.provider_name} to process your request.
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Powered by <span className="font-semibold">Roundi</span>
        </p>
      </div>
    </div>
  );
}
