"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmLabel?: string;
  isDangerous?: boolean;
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  isDangerous = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

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
        aria-labelledby="confirm-modal-title"
        className="fixed left-1/2 top-1/2 z-[1000] w-[90%] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-8 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isDangerous ? "bg-red-100" : "bg-emerald-100"
          }`}
        >
          {isDangerous ? (
            <AlertTriangle className="h-6 w-6 text-red-600" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-700" />
          )}
        </div>

        <h3
          id="confirm-modal-title"
          className="mb-2 text-lg font-semibold leading-7 text-gray-800"
        >
          {title}
        </h3>

        <p className="mb-6 text-sm leading-5 text-gray-500">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors ${
              isDangerous
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
