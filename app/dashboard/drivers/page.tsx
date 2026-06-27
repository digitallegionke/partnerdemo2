"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, FileText, MapPin, Truck, Eye, Search, CheckCircle2, LayoutGrid, List, Upload, Download, ChevronDown, X, Trash2, UserCheck, UserX, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import DriverModal from "@/components/DriverModal";
import DriverViewModal from "@/components/DriverViewModal";
import DriverAssignModal from "@/components/DriverAssignModal";
import { DriverService } from "@/lib/services/drivers";
import type { Database } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";

type Driver = Database["public"]["Tables"]["partner_drivers"]["Row"] & {
  assigned_vehicle?: { plate_number: string; vehicle_type: string; assigned_from: string } | null;
  availability: "available" | "on_duty" | "off_duty";
};
type Provider = Database["public"]["Tables"]["partner_providers"]["Row"];

type FilterTab = "all" | "active" | "inactive" | "available" | "on_duty" | "off_duty";

type DriverFormData = {
  name: string; email: string; phone: string; licenseType: string;
  licenseNumber: string; licenseExpiry: string;
  primaryZone: string; isActive: boolean; availability: string;
};

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "inactive",  label: "Inactive" },
  { key: "available", label: "Available" },
  { key: "on_duty",   label: "On Duty" },
  { key: "off_duty",  label: "Off Duty" },
];

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

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function ProviderDriversPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [drivers, setDrivers]           = useState<Driver[]>([]);
  const [provider, setProvider]         = useState<Provider | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [viewOpen, setViewOpen]         = useState(false);
  const [assignOpen, setAssignOpen]     = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [activeTab, setActiveTab]       = useState<FilterTab>("all");
  const [search, setSearch]             = useState("");
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid");
  const [exportOpen, setExportOpen]           = useState(false);
  const [importing, setImporting]             = useState(false);
  const [importGuideOpen, setImportGuideOpen] = useState(false);
  const [importError, setImportError]         = useState<{ title: string; rows: string[] } | null>(null);
  const [importProgress, setImportProgress]   = useState<{ current: number; total: number } | null>(null);
  const importRef                             = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget]       = useState<Driver | null>(null);
  const [deleting, setDeleting]               = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing]   = useState(false);
  const [pendingFormData, setPendingFormData] = useState<DriverFormData | null>(null);
  const [confirmUpdate, setConfirmUpdate]     = useState(false);
  const [confirmBulkAction, setConfirmBulkAction] = useState<{ type: "delete" | "activate" | "deactivate"; count: number } | null>(null);

  const fetchDrivers = async () => {
    try {
      setError(null);
      const data = await DriverService.getAllDrivers();
      setDrivers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("partner_provider_users")
        .select("provider_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership) return;
      const { data: prov } = await supabase
        .from("partner_providers")
        .select("*")
        .eq("id", (membership as { provider_id: number }).provider_id)
        .single();
      if (prov) setProvider(prov as Provider);
    })();
  }, []);

  const exportTitle =
    activeTab === "active"   ? "Active Drivers" :
    activeTab === "inactive" ? "Inactive Drivers" :
    activeTab === "available" ? "Available Drivers" :
    activeTab === "on_duty"  ? "On Duty Drivers" :
    activeTab === "off_duty" ? "Off Duty Drivers" :
                               "All Drivers";

  const exportExcel = () => {
    const rows = filtered.map((d) => ({
      "Full Name":      d.full_name,
      "Email":          d.email ?? "",
      "Phone Number":   d.phone_number,
      "License Class":  d.license_type ?? "",
      "License Number": d.license_number ?? "",
      "License Expiry": d.license_expiry ?? "",
      "Primary Zone":   d.primary_zone ?? "",
      "Status":         d.is_active ? "Active" : "Inactive",
      "Availability":   d.availability === "on_duty" ? "On Duty" : d.availability === "off_duty" ? "Off Duty" : "Available",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Force the Phone Number column (index 2) to text so Excel preserves the + prefix
    const ref = ws["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: 2 });
        if (ws[addr]) { ws[addr].t = "s"; ws[addr].z = "@"; }
      }
    }
    // Append a total count row after the data
    XLSX.utils.sheet_add_aoa(ws, [[`Total: ${filtered.length} driver${filtered.length !== 1 ? "s" : ""}`]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exportTitle);
    const fileSlug = exportTitle.toLowerCase().replace(/\s+/g, "-");
    XLSX.writeFile(wb, `${fileSlug}.xlsx`);
    setExportOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 14;

    const orgName = provider?.provider_name ?? "Drivers Report";
    doc.setFontSize(16);
    doc.setTextColor(22, 35, 24);
    doc.setFont("helvetica", "bold");
    doc.text(orgName, 14, y);
    y += 7;

    if (provider?.legal_name && provider.legal_name !== provider.provider_name) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(provider.legal_name, 14, y);
      y += 5;
    }

    const infoParts: string[] = [];
    if (provider?.contact_email) infoParts.push(provider.contact_email);
    if (provider?.contact_phone) infoParts.push(provider.contact_phone);
    if (provider?.city)          infoParts.push(provider.city);
    if (provider?.country)       infoParts.push(provider.country);
    if (infoParts.length) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.setFont("helvetica", "normal");
      doc.text(infoParts.join("  ·  "), 14, y);
      y += 5;
    }

    doc.setDrawColor(220);
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFontSize(11);
    doc.setTextColor(22, 35, 24);
    doc.setFont("helvetica", "bold");
    doc.text(exportTitle, 14, y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(`Exported ${format(new Date(), "d MMM yyyy")}`, 196, y, { align: "right" });
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`${filtered.length} driver${filtered.length !== 1 ? "s" : ""}`, 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Full Name", "Phone", "License Class", "License No.", "Zone", "Status", "Availability"]],
      body: filtered.map((d) => [
        d.full_name,
        d.phone_number,
        d.license_type ?? "—",
        d.license_number ?? "—",
        d.primary_zone ?? "—",
        d.is_active ? "Active" : "Inactive",
        d.availability === "on_duty" ? "On Duty" : d.availability === "off_duty" ? "Off Duty" : "Available",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 35, 24] },
    });

    const orgSlug = (provider?.provider_name ?? "drivers").toLowerCase().replace(/\s+/g, "-");
    const fileSlug = exportTitle.toLowerCase().replace(/\s+/g, "-");
    doc.save(`${orgSlug}-${fileSlug}.pdf`);
    setExportOpen(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      const parsed = rows.map((r, i) => {
        const name          = (r["Full Name"] ?? r["full_name"] ?? r["name"] ?? "").toString().trim();
        const email         = (r["Email"] ?? r["email"] ?? r["Email Address"] ?? "").toString().trim();
        const rawPhone      = (r["Phone Number"] ?? r["phone_number"] ?? r["phone"] ?? "").toString().trim();
        const phone         = rawPhone && !rawPhone.startsWith("+") ? `+${rawPhone}` : rawPhone;
        const licenseNumber = (r["License Number"] ?? r["license_number"] ?? "").toString().trim();
        const status = (r["Status"] ?? r["status"] ?? "").toString().toLowerCase().trim();
        const avail  = (r["Availability"] ?? r["availability"] ?? "").toString().toLowerCase().trim();
        const validStatus = status === "active" ? true : status === "inactive" ? false : null;
        const availMap: Record<string, string> = { available: "available", "on duty": "on_duty", on_duty: "on_duty", "off duty": "off_duty", off_duty: "off_duty" };
        const validAvail = availMap[avail] ?? null;
        return {
          row: i + 2,
          name,
          email,
          phone,
          license_type:   (r["License Class"] ?? r["license_type"] ?? "").toString().trim() || "",
          license_number: licenseNumber,
          license_expiry: (r["License Expiry"] ?? r["license_expiry"] ?? "").toString().trim() || null,
          primary_zone:   (r["Primary Zone"] ?? r["primary_zone"] ?? r["zone"] ?? "").toString().trim() || null,
          is_active:      validStatus,
          availability:   validAvail,
          missingName:          !name,
          missingEmail:         !email,
          missingPhone:         !phone,
          missingLicenseNumber: !licenseNumber,
          missingStatus:        validStatus === null,
          missingAvail:         validAvail === null,
        };
      });

      const invalidRows = parsed.filter((r) => r.missingName || r.missingEmail || r.missingPhone || r.missingLicenseNumber || r.missingStatus || r.missingAvail);
      if (invalidRows.length) {
        const lines = invalidRows.map((r) => {
          const missing = [
            r.missingName          && "Full Name",
            r.missingEmail         && "Email",
            r.missingPhone         && "Phone Number",
            r.missingLicenseNumber && "License Number",
            r.missingStatus        && "Status",
            r.missingAvail         && "Availability",
          ].filter(Boolean).join(", ");
          return `Row ${r.row}: missing ${missing}`;
        });
        setImportError({
          title: `Upload failed — ${invalidRows.length} row${invalidRows.length > 1 ? "s are" : " is"} missing required fields`,
          rows: lines,
        });
        return;
      }

      const toCreate = parsed as (typeof parsed[0] & { is_active: boolean; availability: string })[];
      if (!toCreate.length) {
        toast({ variant: "destructive", title: "No data found", description: "Make sure the sheet has data and a 'Full Name' column." });
        return;
      }

      let created = 0;
      const rowErrors: string[] = [];
      setImportProgress({ current: 0, total: toCreate.length });
      for (let i = 0; i < toCreate.length; i++) {
        const row = toCreate[i];
        try {
          const result = await DriverService.createDriver({
            full_name:      row.name,
            email:          row.email || null,
            phone_number:   row.phone,
            license_type:   row.license_type ?? "",
            license_number: row.license_number ?? "",
            license_expiry: row.license_expiry ?? null,
            primary_zone:   row.primary_zone ?? null,
            is_active:      row.is_active,
            availability:   row.availability as Driver["availability"],
          });
          setDrivers((prev) => [result, ...prev]);
          created++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const reason =
            msg.includes("uq_partner_drivers_provider_phone") || msg.includes("phone") ? "phone number already exists" :
            msg.includes("uq_partner_drivers_provider_license") || msg.includes("license") ? "license number already exists" :
            msg.includes("uq_partner_drivers_email") || (msg.includes("email") && msg.includes("unique")) ? "email already exists" :
            msg;
          rowErrors.push(`Row ${i + 2} (${row.name}): ${reason}`);
        }
        setImportProgress({ current: i + 1, total: toCreate.length });
      }
      setImportProgress(null);
      window.dispatchEvent(new Event("navcount:refresh"));

      if (rowErrors.length) {
        setImportError({
          title: `${created} of ${toCreate.length} imported — ${rowErrors.length} row${rowErrors.length !== 1 ? "s" : ""} failed`,
          rows: rowErrors,
        });
      } else {
        toast({
          title: "Import successful",
          description: `${created} of ${toCreate.length} driver${toCreate.length !== 1 ? "s" : ""} imported successfully.`,
        });
      }
    } catch {
      setImportProgress(null);
      toast({ variant: "destructive", title: "Import failed", description: "Failed to read the file. Please use a valid Excel file." });
    } finally {
      setImporting(false);
    }
  };

  // Auto-open the add-driver modal when navigated with ?action=add
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setSelectedDriver(null);
      setModalOpen(true);
    }
  }, [searchParams]);

  const handleAddDriver    = () => { setSelectedDriver(null); setModalOpen(true); };
  const handleViewDriver   = (d: Driver) => { setSelectedDriver(d); setViewOpen(true); };
  const handleEditDriver   = (d: Driver) => { setSelectedDriver(d); setModalOpen(true); };
  const handleAssignDriver = (d: Driver) => { setSelectedDriver(d); setAssignOpen(true); };

  const handleDeleteDriver = (d: Driver) => setDeleteTarget(d);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const name = deleteTarget.full_name;
    try {
      await DriverService.deleteDriver(deleteTarget.id);
      setDrivers((prev) => prev.filter((dr) => dr.id !== deleteTarget.id));
      window.dispatchEvent(new Event("navcount:refresh"));
      setDeleteTarget(null);
      toast({ title: "Driver deleted", description: `${name} has been removed.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete driver." });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((d) => next.delete(d.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((d) => next.add(d.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = () => {
    if (!selectedIds.size) return;
    setConfirmBulkAction({ type: "delete", count: selectedIds.size });
  };

  const handleBulkSetActive = (isActive: boolean) => {
    if (!selectedIds.size) return;
    setConfirmBulkAction({ type: isActive ? "activate" : "deactivate", count: selectedIds.size });
  };

  const executeBulkAction = async () => {
    if (!confirmBulkAction) return;
    setBulkProcessing(true);
    setConfirmBulkAction(null);
    if (confirmBulkAction.type === "delete") {
      let deleted = 0;
      for (const id of selectedIds) {
        try { await DriverService.deleteDriver(id); deleted++; } catch { /* skip */ }
      }
      setDrivers((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      clearSelection();
      window.dispatchEvent(new Event("navcount:refresh"));
      setBulkProcessing(false);
      toast({ title: "Deleted", description: `${deleted} driver${deleted !== 1 ? "s" : ""} deleted.` });
    } else {
      const isActive = confirmBulkAction.type === "activate";
      let updated = 0;
      const updatedDrivers: Driver[] = [];
      for (const id of selectedIds) {
        try {
          const result = await DriverService.updateDriver(id, { is_active: isActive });
          updatedDrivers.push(result);
          updated++;
        } catch { /* skip */ }
      }
      setDrivers((prev) => prev.map((d) => updatedDrivers.find((u) => u.id === d.id) ?? d));
      clearSelection();
      window.dispatchEvent(new Event("navcount:refresh"));
      setBulkProcessing(false);
      toast({ title: isActive ? "Activated" : "Deactivated", description: `${updated} driver${updated !== 1 ? "s" : ""} ${isActive ? "activated" : "deactivated"}.` });
    }
  };

  const handleAssignSaved = (updated: Driver) => {
    setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setAssignOpen(false);
  };

  const handleSave = async (formData: DriverFormData) => {
    if (selectedDriver) {
      setPendingFormData(formData);
      setConfirmUpdate(true);
      setModalOpen(false);
      return;
    }
    try {
      const created = await DriverService.createDriver({
        full_name:       formData.name,
        email:           formData.email || null,
        phone_number:    formData.phone,
        license_type:    formData.licenseType,
        license_number:  formData.licenseNumber,
        license_expiry:  formData.licenseExpiry || null,
        primary_zone:    formData.primaryZone || null,
        is_active:       formData.isActive,
        availability:    formData.availability as Driver["availability"],
      });
      setDrivers((prev) => [created, ...prev]);
      toast({ title: "Driver added", description: `${formData.name} has been added successfully.` });
      window.dispatchEvent(new Event("navcount:refresh"));
      setModalOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : "Failed to save driver." });
    }
  };

  const executeUpdate = async () => {
    if (!selectedDriver || !pendingFormData) return;
    const formData = pendingFormData;
    try {
      const updated = await DriverService.updateDriver(selectedDriver.id, {
        full_name:       formData.name,
        email:           formData.email || null,
        phone_number:    formData.phone,
        license_type:    formData.licenseType,
        license_number:  formData.licenseNumber,
        license_expiry:  formData.licenseExpiry || null,
        primary_zone:    formData.primaryZone || null,
        is_active:       formData.isActive,
        availability:    formData.availability as Driver["availability"],
      });
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      toast({ title: "Driver updated", description: `${formData.name} has been updated successfully.` });
      window.dispatchEvent(new Event("navcount:refresh"));
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update driver." });
    } finally {
      setConfirmUpdate(false);
      setPendingFormData(null);
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: drivers.length, active: 0, inactive: 0, available: 0, on_duty: 0, off_duty: 0 };
    drivers.forEach((d) => {
      if (d.is_active) {
        counts.active++;
        if (d.availability in counts) counts[d.availability as FilterTab]++;
      } else {
        counts.inactive++;
      }
    });
    return counts;
  }, [drivers]);

  const filtered = useMemo(() => {
    let list =
      activeTab === "all"      ? drivers :
      activeTab === "active"   ? drivers.filter((d) => d.is_active) :
      activeTab === "inactive" ? drivers.filter((d) => !d.is_active) :
      drivers.filter((d) => d.is_active && d.availability === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.full_name.toLowerCase().includes(q) || d.phone_number.includes(q)
      );
    }
    return list;
  }, [drivers, activeTab, search]);

  const allFilteredSelected  = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const someFilteredSelected = filtered.some((d) => selectedIds.has(d.id));

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-4 sm:px-8 py-4 sm:py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Drivers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your fleet drivers, their vehicle details, and availability status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import */}
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={() => setImportGuideOpen(true)}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {importing ? "Importing…" : "Import"}
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                disabled={drivers.length === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-40 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <button
                      onClick={exportExcel}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                    >
                      <span className="text-base">📊</span> Excel (.xlsx)
                    </button>
                    <button
                      onClick={exportPDF}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5 border-t border-gray-100"
                    >
                      <span className="text-base">📄</span> PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleAddDriver}
              style={{
                padding: "10px 20px", fontSize: 14, fontWeight: 600,
                color: "#162318", backgroundColor: "#CDF782",
                border: "none", borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Driver
            </button>
          </div>
        </div>

        {/* Stats cards */}
        {!loading && !error && drivers.length > 0 && (
          <div className="px-4 sm:px-8 pt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Drivers", value: tabCounts.all },
              { label: "Active",        value: tabCounts.active },
              { label: "Inactive",      value: tabCounts.inactive },
              { label: "Available",     value: tabCounts.available },
              { label: "On Duty",       value: tabCounts.on_duty },
              { label: "Off Duty",      value: tabCounts.off_duty },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{stat.label}</p>
                <p className="text-xl font-bold text-gray-800 leading-tight mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + filter tabs + view toggle */}
        {!loading && !error && (
          <div className="px-4 sm:px-8 pt-5 pb-4 space-y-2.5">
            {/* Row 1: Search */}
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Row 2: Select-all + Tabs + view toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                {/* Select all checkbox */}
                {filtered.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="shrink-0 flex items-center justify-center h-5 w-5 rounded border border-gray-300 bg-white hover:border-emerald-500 transition-colors"
                    title={allFilteredSelected ? "Deselect all" : "Select all"}
                  >
                    {allFilteredSelected ? (
                      <span className="block h-3 w-3 rounded-sm bg-emerald-500" />
                    ) : someFilteredSelected ? (
                      <span className="block h-0.5 w-2.5 bg-emerald-400 rounded" />
                    ) : null}
                  </button>
                )}
                <div className="flex items-center gap-1">
                  {TABS.map((tab, i) => (
                    <React.Fragment key={tab.key}>
                      {i === 3 && <span className="mx-1 h-4 w-px bg-gray-200 hidden sm:block shrink-0" />}
                      <button
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? { backgroundColor: "#CDF782", color: "#162318" } : {}}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
                          activeTab === tab.key ? "" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                        }`}
                      >
                        {tab.label}
                        {tabCounts[tab.key] > 0 && (
                          <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "opacity-60" : "text-gray-400"}`}>
                            {tabCounts[tab.key]}
                          </span>
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 sm:px-8 mb-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="text-sm font-semibold text-gray-700 pr-1">
                {selectedIds.size} selected
              </span>
              <span className="w-px h-4 bg-gray-200" />
              <button
                onClick={() => handleBulkSetActive(true)}
                disabled={bulkProcessing}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors disabled:opacity-50"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkSetActive(false)}
                disabled={bulkProcessing}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Deactivate
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkProcessing}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
              >
                {bulkProcessing ? "Processing…" : "Delete"}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading drivers...</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-sm font-medium text-red-600">Failed to load drivers</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDrivers}>Try again</Button>
          </div>

        ) : drivers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No drivers yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  You haven&apos;t added any drivers to your fleet. Add your first driver to start managing assignments and availability.
                </p>
              </div>
              <button
                onClick={handleAddDriver}
                style={{
                  padding: "10px 20px", fontSize: 14, fontWeight: 600,
                  color: "#162318", backgroundColor: "#CDF782",
                  border: "none", borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
              >
                <Plus className="h-4 w-4" />
                Add your first driver
              </button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No drivers found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : viewMode === "list" ? (
          /* ── Table view ── */
          <div className="px-4 sm:px-8 pb-8 overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pt-1 pr-4 w-8" />
                  {["DRIVER", "EMAIL", "STATUS", "AVAILABILITY", "LICENSE", "ZONE", "VEHICLE", "ACTIONS"].map((h) => (
                    <th key={h} className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 first:pl-0 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((driver) => (
                  <tr key={driver.id} className={`transition-colors ${selectedIds.has(driver.id) ? "bg-emerald-50/60" : "hover:bg-gray-50/50"}`}>
                    {/* Checkbox */}
                    <td className="py-3.5 pr-4">
                      <button
                        onClick={() => toggleSelect(driver.id)}
                        className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                          selectedIds.has(driver.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                        }`}
                      >
                        {selectedIds.has(driver.id) && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>
                    {/* Driver */}
                    <td className="py-3.5 pr-4">
                      <button onClick={() => handleViewDriver(driver)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
                        <div className={`h-9 w-9 shrink-0 rounded-full ${avatarColor(driver.id)} text-white text-xs font-bold flex items-center justify-center`}>
                          {getInitials(driver.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{driver.full_name}</p>
                          <p className="text-xs text-gray-400">{driver.phone_number}</p>
                        </div>
                      </button>
                    </td>
                    {/* Email */}
                    <td className="py-3.5 pr-4 text-xs text-gray-500 whitespace-nowrap">
                      {driver.email ?? <span className="text-gray-300">—</span>}
                    </td>
                    {/* Status */}
                    <td className="py-3.5 pr-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${driver.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {driver.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {/* Availability */}
                    <td className="py-3.5 pr-4">
                      {driver.is_active ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${AVAIL_STYLE[driver.availability] ?? "bg-gray-100 text-gray-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${AVAIL_DOT[driver.availability] ?? "bg-gray-400"}`} />
                          {AVAIL_LABEL[driver.availability] ?? driver.availability}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    {/* License */}
                    <td className="py-3.5 pr-4">
                      <p className="text-xs text-gray-500 mb-1">{driver.license_number}</p>
                      <div className="flex flex-wrap gap-1">
                        {driver.license_type
                          ? driver.license_type.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                              <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{c}</span>
                            ))
                          : <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    {/* Zone */}
                    <td className="py-3.5 pr-4 text-sm text-gray-700 whitespace-nowrap">
                      {driver.primary_zone ?? <span className="text-gray-300">—</span>}
                    </td>
                    {/* Vehicle */}
                    <td className="py-3.5 pr-4 text-sm whitespace-nowrap">
                      {driver.assigned_vehicle ? (
                        <span className="font-medium text-gray-800">
                          {driver.assigned_vehicle.plate_number}
                          <span className="ml-1 text-xs text-gray-400 capitalize font-normal">({driver.assigned_vehicle.vehicle_type})</span>
                        </span>
                      ) : <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    {/* Actions — icons only */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => handleViewDriver(driver)} title="View"
                          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleEditDriver(driver)} title="Edit"
                          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAssignDriver(driver)}
                          title={driver.availability === "on_duty" ? "Assigned" : "Assign vehicle"}
                          className={`p-1.5 rounded transition-colors ${
                            driver.availability === "on_duty"
                              ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {driver.availability === "on_duty"
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <Plus className="h-4 w-4" />}
                        </button>
                        <button onClick={() => handleDeleteDriver(driver)} title="Delete"
                          className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : (
          /* ── Card / Grid view ── */
          <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((driver) => (
              <div
                key={driver.id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col ${selectedIds.has(driver.id) ? "border-emerald-400 ring-1 ring-emerald-300" : "border-gray-100"}`}
              >
                {/* Header */}
                <div className="relative px-5 pt-4 pb-3">
                  <div className="absolute top-3 right-3 flex items-center gap-0.5">
                    <button
                      onClick={() => handleEditDriver(driver)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                      title="Edit driver"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDriver(driver)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete driver"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(driver.id)}
                      className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ml-0.5 ${
                        selectedIds.has(driver.id)
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-gray-300 bg-white hover:border-emerald-400"
                      }`}
                      title="Select driver"
                    >
                      {selectedIds.has(driver.id) && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 pr-24">
                    <div className={`h-11 w-11 shrink-0 rounded-full ${avatarColor(driver.id)} text-white text-sm font-bold flex items-center justify-center`}>
                      {getInitials(driver.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate leading-snug">{driver.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{driver.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${driver.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {driver.is_active ? "Active" : "Inactive"}
                    </span>
                    {driver.is_active && (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${AVAIL_STYLE[driver.availability] ?? "bg-gray-100 text-gray-500"}`}>
                        {AVAIL_LABEL[driver.availability] ?? driver.availability}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="border-t px-5 py-3 space-y-2 text-sm text-gray-600">
                  {driver.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate text-gray-600">{driver.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{driver.license_number}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className={driver.primary_zone ? "text-gray-700" : "text-gray-400"}>
                      {driver.primary_zone ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {driver.license_type
                        ? driver.license_type.split(",").map((cls) => cls.trim()).filter(Boolean).map((cls) => (
                            <span key={cls} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{cls}</span>
                          ))
                        : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {driver.assigned_vehicle ? (
                      <span>
                        Vehicle:{" "}
                        <span className="font-semibold text-gray-800">{driver.assigned_vehicle.plate_number}</span>
                        <span className="text-gray-400 ml-1 capitalize">({driver.assigned_vehicle.vehicle_type})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No vehicle assigned</span>
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

                {/* Actions */}
                <div className="border-t grid grid-cols-2 gap-3 p-3">
                  <button
                    onClick={() => handleViewDriver(driver)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  {driver.availability === "on_duty" ? (
                    <button
                      onClick={() => handleAssignDriver(driver)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-blue-300 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Assigned
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssignDriver(driver)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500 py-2 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Assign
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DriverViewModal
        driver={selectedDriver}
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        onEdit={() => handleEditDriver(selectedDriver!)}
      />

      <DriverModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        driver={selectedDriver}
      />

      <DriverAssignModal
        driver={selectedDriver}
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSaved={handleAssignSaved}
      />

      <DeleteConfirmModal
        driver={deleteTarget}
        deleting={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {importProgress && (
        <ImportProgressModal current={importProgress.current} total={importProgress.total} />
      )}

      {importError && (
        <ImportErrorModal
          title={importError.title}
          rows={importError.rows}
          onClose={() => setImportError(null)}
        />
      )}

      <ImportGuideModal
        isOpen={importGuideOpen}
        onClose={() => setImportGuideOpen(false)}
        onProceed={() => { setImportGuideOpen(false); importRef.current?.click(); }}
      />

      {/* Confirm update modal */}
      {confirmUpdate && pendingFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setConfirmUpdate(false); setPendingFormData(null); }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Do you want to update {pendingFormData.name}?
              </h3>
              <button onClick={() => { setConfirmUpdate(false); setPendingFormData(null); }} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => { setConfirmUpdate(false); setPendingFormData(null); }}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeUpdate}
                className="flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors"
                style={{ backgroundColor: "#CDF782", color: "#162318" }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm bulk action modal */}
      {confirmBulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmBulkAction(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className={`text-sm font-semibold ${confirmBulkAction.type === "delete" ? "text-red-600" : "text-gray-900"}`}>
                {confirmBulkAction.type === "delete"
                  ? `Do you want to delete ${confirmBulkAction.count} driver${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : confirmBulkAction.type === "activate"
                  ? `Do you want to activate ${confirmBulkAction.count} driver${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : `Do you want to deactivate ${confirmBulkAction.count} driver${confirmBulkAction.count !== 1 ? "s" : ""}?`}
              </h3>
              <button onClick={() => setConfirmBulkAction(null)} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setConfirmBulkAction(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                disabled={bulkProcessing}
                className={`flex-1 rounded-xl text-sm font-semibold py-2.5 transition-colors disabled:opacity-50 ${
                  confirmBulkAction.type === "delete"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : ""
                }`}
                style={confirmBulkAction.type !== "delete" ? { backgroundColor: "#CDF782", color: "#162318" } : undefined}
              >
                {bulkProcessing ? "Processing…" : confirmBulkAction.type === "delete" ? "Delete" : confirmBulkAction.type === "activate" ? "Activate" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Delete Confirm Modal ─── */

function DeleteConfirmModal({
  driver,
  deleting,
  onConfirm,
  onCancel,
}: {
  driver: Driver | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!driver) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <h3 className="text-sm font-semibold text-red-600">
            Do you want to delete {driver.full_name}?
          </h3>
          <button onClick={onCancel} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold text-white py-2.5 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete Driver"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Import Progress Modal ─── */

function ImportProgressModal({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 px-8 py-8">
        <div className="flex justify-center mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
            <Upload className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="text-center mb-6">
          <h3 className="text-sm font-semibold text-gray-900">Importing drivers…</h3>
          <p className="mt-1 text-xs text-gray-400">{current} of {total} row{total !== 1 ? "s" : ""} processed</p>
        </div>
        <div className="w-full rounded-full bg-gray-100 h-2.5 overflow-hidden">
          <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: "#CDF782" }} />
        </div>
        <p className="mt-2 text-right text-xs font-semibold text-gray-500">{pct}%</p>
      </div>
    </div>
  );
}

/* ─── Import Error Modal ─── */

function ImportErrorModal({ title, rows, onClose }: { title: string; rows: string[]; onClose: () => void }) {
  const isPartial = title.startsWith("Upload failed") === false;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
        <div className={`flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b ${isPartial ? "border-amber-100 bg-amber-50" : "border-red-100 bg-red-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border ${isPartial ? "border-amber-200" : "border-red-200"}`}>
              <X className={`h-5 w-5 ${isPartial ? "text-amber-500" : "text-red-500"}`} />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isPartial ? "text-amber-700" : "text-red-700"}`}>
                {isPartial ? "Import completed with errors" : "Upload Failed"}
              </h3>
              <p className={`text-xs mt-0.5 ${isPartial ? "text-amber-600" : "text-red-500"}`}>{title}</p>
            </div>
          </div>
          <button onClick={onClose} className={`shrink-0 transition-colors rounded-md p-1 ${isPartial ? "text-amber-400 hover:text-amber-600 hover:bg-amber-100" : "text-red-400 hover:text-red-600 hover:bg-red-100"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs text-gray-500">
            {isPartial ? "The following rows could not be imported:" : "The following rows have missing required fields:"}
          </p>
          <div className={`rounded-xl border divide-y max-h-52 overflow-y-auto ${isPartial ? "border-amber-100 bg-amber-50 divide-amber-100" : "border-red-100 bg-red-50 divide-red-100"}`}>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isPartial ? "bg-amber-400" : "bg-red-400"}`} />
                <span className={`text-xs ${isPartial ? "text-amber-700" : "text-red-700"}`}>{row}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {isPartial
              ? "Successfully imported drivers have been added. Fix the issues above and re-import the failed rows."
              : "Please update your file with the missing values and try uploading again."}
          </p>
        </div>
        <div className="px-6 pb-6 pt-1">
          <button
            onClick={onClose}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600,
              color: "#162318", backgroundColor: "#CDF782",
              border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            Got it, I&apos;ll fix the file
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Import Guide Modal ─── */

const DRIVER_IMPORT_COLUMNS = [
  { name: "Full Name",      required: true,  example: "John Kamau",                   note: "Driver's full name" },
  { name: "Email",          required: true,  example: "john@example.com",             note: "Must be unique across all drivers" },
  { name: "Phone Number",   required: true,  example: "+254712345678",                note: "Driver's phone number" },
  { name: "License Number", required: true,  example: "DL1234567",                   note: "Must be unique per driver" },
  { name: "Status",         required: true,  example: "Active / Inactive",            note: "Must be Active or Inactive" },
  { name: "Availability",   required: true,  example: "Available / On Duty / Off Duty", note: "Driver availability status" },
  { name: "License Class",  required: false, example: "A3, B1",                      note: "Comma-separated license classes" },
  { name: "License Expiry", required: false, example: "2026-12-31",                  note: "Expiry date (YYYY-MM-DD)" },
  { name: "Primary Zone",   required: false, example: "Westlands",                   note: "Driver's operating zone" },
];

function ImportGuideModal({ isOpen, onClose, onProceed }: { isOpen: boolean; onClose: () => void; onProceed: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
              <Upload className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Import Drivers</h3>
              <p className="text-xs text-gray-400 mt-0.5">Prepare your Excel file using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <span className="text-base">📋</span>
            <p className="text-xs text-blue-700">Accepted file types: <strong>.xlsx</strong> or <strong>.xls</strong>. The first sheet will be used.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Required columns</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Column Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {DRIVER_IMPORT_COLUMNS.map((col) => (
                    <tr key={col.name}>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{col.name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {col.required
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Required</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"><span className="h-1.5 w-1.5 rounded-full bg-gray-300 inline-block" />Optional</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 italic">{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <span className="text-base mt-0.5">💡</span>
            <p className="text-xs text-amber-700">
              Column names must match exactly as shown. Availability must be <strong>Available</strong>, <strong>On Duty</strong>, or <strong>Off Duty</strong>.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 pt-1 flex gap-2">
          <button
            onClick={onProceed}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600,
              color: "#162318", backgroundColor: "#CDF782",
              border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
          >
            <Upload className="h-4 w-4" />
            Browse File
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-[10px] border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
