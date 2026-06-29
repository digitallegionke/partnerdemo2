"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Truck, Plus, Pencil, Search, X, Eye,
  Bike, Package, CheckCircle2, User,
  Fuel, ShieldCheck, CalendarIcon,
  Upload, Download, ChevronDown,
  LayoutGrid, List, Trash2, UserCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import { FleetService, type FleetVehicle } from "@/lib/services/fleet";
import FleetViewModal from "@/components/FleetViewModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { parse, format, isValid } from "date-fns";
import "react-day-picker/style.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type VehicleType = "motorbike" | "bicycle" | "car" | "van" | "truck" | "other";
type FleetStatus = "available" | "assigned" | "in_maintenance";
type FleetAvailability = FleetStatus;
type FilterTab = "all" | "active" | "inactive" | FleetStatus;

// Extend FleetVehicle with enriched driver name from GET
type FleetVehicleEnriched = FleetVehicle & { assigned_driver_name?: string | null };

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all",            label: "All" },
  { key: "active",         label: "Active" },
  { key: "inactive",       label: "Inactive" },
  { key: "available",      label: "Available" },
  { key: "assigned",       label: "Assigned" },
  { key: "in_maintenance", label: "In Maintenance" },
];

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  motorbike: "Motorbike",
  bicycle:   "Bicycle",
  car:       "Car",
  van:       "Van",
  truck:     "Truck",
  other:     "Other",
};

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "motorbike", label: "Motorbike" },
  { value: "bicycle",   label: "Bicycle" },
  { value: "car",       label: "Car" },
  { value: "van",       label: "Van" },
  { value: "truck",     label: "Truck" },
  { value: "other",     label: "Other" },
];

const FUEL_TYPES = [
  { value: "petrol",   label: "Petrol" },
  { value: "diesel",   label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid",   label: "Hybrid" },
  { value: "cng",      label: "CNG" },
  { value: "other",    label: "Other" },
];

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

function VehicleIcon({ type, className }: { type: string; className?: string }) {
  if (type === "motorbike" || type === "bicycle") return <Bike className={className} />;
  if (type === "van" || type === "truck") return <Truck className={className} />;
  return <Package className={className} />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  if (!display) return "";
  const [d, m, y] = display.split("/");
  if (!d || !m || !y || y.length !== 4) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function DatePickerInput({ value, onChange, className }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const selected = useMemo(() => {
    if (!value) return undefined;
    const parsed = parse(value, "dd/MM/yyyy", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${className} flex items-center justify-between w-full text-left ${!value ? "text-gray-400" : "text-gray-900"}`}
        >
          <span>{value || "dd/mm/yyyy"}</span>
          <CalendarIcon size={15} className="text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout="dropdown"
          startMonth={new Date(1990, 0)}
          endMonth={new Date(2100, 11)}
          onSelect={(date) => {
            if (date) onChange(format(date, "dd/MM/yyyy"));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type FormState = {
  plate_number: string;
  vehicle_type: VehicleType;
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  fuel_type: string;
  capacity_kg: string;
  odometer_km: string;
  is_active: boolean;
  availability: string;
  last_service_date: string;
  insurance_expiry: string;
  inspection_expiry: string;
  allowed_license: string[];
  notes: string;
};

const EMPTY_FORM: FormState = {
  plate_number: "",
  vehicle_type: "motorbike",
  make: "",
  model: "",
  year: "",
  color: "",
  vin: "",
  fuel_type: "",
  capacity_kg: "",
  odometer_km: "",
  is_active: true,
  availability: "available",
  last_service_date: "",
  insurance_expiry: "",
  inspection_expiry: "",
  allowed_license: [],
  notes: "",
};

export default function FleetRegistryPage() {
  const { toast } = useToast();
  const [vehicles, setVehicles]     = useState<FleetVehicleEnriched[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<FilterTab>("all");
  const [search, setSearch]         = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<FleetVehicleEnriched | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);
  const [viewing, setViewing]       = useState<FleetVehicleEnriched | null>(null);
  const [provider, setProvider]     = useState<Database["public"]["Tables"]["partner_providers"]["Row"] | null>(null);
  const [viewMode, setViewMode]                 = useState<"grid" | "list">("grid");
  const [exportOpen, setExportOpen]             = useState(false);
  const [importing, setImporting]               = useState(false);
  const [importGuideOpen, setImportGuideOpen]   = useState(false);
  const [importError, setImportError]           = useState<{ title: string; rows: string[] } | null>(null);
  const [importProgress, setImportProgress]     = useState<{ current: number; total: number } | null>(null);
  const importRef                               = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds]           = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing]     = useState(false);
  const [deleteTarget, setDeleteTarget]         = useState<FleetVehicleEnriched | null>(null);
  const [deleting, setDeleting]                 = useState(false);
  const [confirmBulkAction, setConfirmBulkAction] = useState<{ type: "delete" | "activate" | "deactivate"; count: number } | null>(null);
  const [confirmUpdate, setConfirmUpdate]         = useState(false);
  const [pendingForm, setPendingForm]             = useState<FormState | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("partner_provider_users").select("provider_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!membership) return;
      const { data: prov } = await supabase
        .from("partner_providers").select("*")
        .eq("id", (membership as { provider_id: number }).provider_id).single();
      if (prov) setProvider(prov as Database["public"]["Tables"]["partner_providers"]["Row"]);
    })();
  }, []);

  const exportExcel = () => {
    const rows = filtered.map((v) => ({
      "Registration Plate":    v.plate_number,
      "Vehicle Type":          VEHICLE_TYPE_LABEL[v.vehicle_type] ?? v.vehicle_type,
      "Status":                v.is_active ? "Active" : "Inactive",
      "Vehicle Availability":  STATUS_LABEL[v.availability] ?? v.availability,
      "Make":                  v.make ?? "",
      "Model":                 v.model ?? "",
      "Year":                  v.year ?? "",
      "Color":                 v.color ?? "",
      "VIN":                   v.vin ?? "",
      "Fuel Type":             v.fuel_type ?? "",
      "Capacity (kg)":         v.capacity_kg ?? "",
      "Odometer Reading (km)": v.odometer_km ?? "",
      "Last Service Date":     v.last_service_date ?? "",
      "Insurance Expiry":      v.insurance_expiry ?? "",
      "Inspection Expiry":     v.inspection_expiry ?? "",
      "Allowed Driving License": v.allowed_license ?? "",
      "Notes":                 v.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fleet");
    XLSX.writeFile(wb, "fleet-registry.xlsx");
    setExportOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    let y = 14;

    const orgName = provider?.provider_name ?? "Fleet Registry";
    doc.setFontSize(16); doc.setTextColor(22, 35, 24); doc.setFont("helvetica", "bold");
    doc.text(orgName, 14, y); y += 7;

    if (provider?.legal_name && provider.legal_name !== provider.provider_name) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(provider.legal_name, 14, y); y += 5;
    }
    const infoParts: string[] = [];
    if (provider?.contact_email) infoParts.push(provider.contact_email);
    if (provider?.contact_phone) infoParts.push(provider.contact_phone);
    if (provider?.city)          infoParts.push(provider.city);
    if (provider?.country)       infoParts.push(provider.country);
    if (infoParts.length) {
      doc.setFontSize(8); doc.setTextColor(120); doc.setFont("helvetica", "normal");
      doc.text(infoParts.join("  ·  "), 14, y); y += 5;
    }
    doc.setDrawColor(220); doc.line(14, y, 283, y); y += 5;

    const tabLabel = activeTab === "active" ? "Active Vehicles" : activeTab === "inactive" ? "Inactive Vehicles" : activeTab === "available" ? "Available Vehicles" : activeTab === "assigned" ? "Assigned Vehicles" : activeTab === "in_maintenance" ? "In Maintenance Vehicles" : "All Vehicles";
    doc.setFontSize(11); doc.setTextColor(22, 35, 24); doc.setFont("helvetica", "bold");
    doc.text(tabLabel, 14, y);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
    doc.text(`Exported ${format(new Date(), "d MMM yyyy")}`, 283, y, { align: "right" }); y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Plate", "Type", "Status", "Availability", "Make", "Model", "Year", "Color", "Fuel", "Capacity (kg)", "Odometer (km)", "License Classes"]],
      body: filtered.map((v) => [
        v.plate_number,
        VEHICLE_TYPE_LABEL[v.vehicle_type] ?? v.vehicle_type,
        v.is_active ? "Active" : "Inactive",
        STATUS_LABEL[v.availability] ?? v.availability,
        v.make ?? "—",
        v.model ?? "—",
        v.year ?? "—",
        v.color ?? "—",
        v.fuel_type ?? "—",
        v.capacity_kg ?? "—",
        v.odometer_km ?? "—",
        v.allowed_license ?? "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 35, 24] },
    });

    const slug = (provider?.provider_name ?? "fleet").toLowerCase().replace(/\s+/g, "-");
    doc.save(`${slug}-fleet-registry.pdf`);
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

      const VEHICLE_TYPE_MAP: Record<string, string> = {
        motorbike: "motorbike", bicycle: "bicycle", car: "car",
        van: "van", truck: "truck", other: "other",
      };
      const STATUS_MAP: Record<string, string> = {
        available: "available", assigned: "assigned",
        "in maintenance": "in_maintenance", in_maintenance: "in_maintenance",
      };

      const parsed = rows.map((r, i) => {
        const plate        = (r["Registration Plate"] ?? r["plate_number"] ?? "").toString().trim().toUpperCase();
        const vtype        = (r["Vehicle Type"] ?? r["vehicle_type"] ?? "").toString().trim().toLowerCase();
        const activeRaw    = (r["Status"] ?? r["status"] ?? "").toString().trim().toLowerCase();
        const availRaw     = (r["Vehicle Availability"] ?? r["vehicle_availability"] ?? "").toString().trim().toLowerCase();
        const isActiveVal  = activeRaw === "active" ? true : activeRaw === "inactive" ? false : null;
        return {
          row:            i + 2,
          plate_number:   plate,
          vehicle_type:   VEHICLE_TYPE_MAP[vtype] ?? null,
          status:         STATUS_MAP[availRaw] ?? null,
          is_active:      isActiveVal,
          make:           (r["Make"] ?? "").toString().trim() || null,
          model:          (r["Model"] ?? "").toString().trim() || null,
          year:           r["Year"] ? Number(r["Year"]) || null : null,
          color:          (r["Color"] ?? "").toString().trim() || null,
          vin:            (r["VIN"] ?? "").toString().trim() || null,
          fuel_type:      (r["Fuel Type"] ?? r["fuel_type"] ?? "").toString().trim().toLowerCase() || null,
          capacity_kg:    r["Capacity (kg)"] ? Number(r["Capacity (kg)"]) || null : null,
          odometer_km:    r["Odometer Reading (km)"] ? Number(r["Odometer Reading (km)"]) || null : null,
          last_service_date: (r["Last Service Date"] ?? "").toString().trim() || null,
          insurance_expiry:  (r["Insurance Expiry"] ?? "").toString().trim() || null,
          inspection_expiry: (r["Inspection Expiry"] ?? "").toString().trim() || null,
          allowed_license:   (r["Allowed Driving License"] ?? r["allowed_license"] ?? "").toString().trim() || null,
          notes:             (r["Notes"] ?? "").toString().trim() || null,
          missingPlate:       !plate,
          missingType:        !VEHICLE_TYPE_MAP[vtype],
          missingStatus:      isActiveVal === null,
          missingAvailability: !STATUS_MAP[availRaw],
        };
      });

      const invalidRows = parsed.filter((r) => r.missingPlate || r.missingType || r.missingStatus || r.missingAvailability);
      if (invalidRows.length) {
        const lines = invalidRows.map((r) => {
          const missing = [
            r.missingPlate        && "Registration Plate",
            r.missingType         && "Vehicle Type",
            r.missingStatus       && "Status",
            r.missingAvailability && "Vehicle Availability",
          ].filter(Boolean).join(", ");
          return `Row ${r.row}: missing ${missing}`;
        });
        setImportError({
          title: `Upload failed — ${invalidRows.length} row${invalidRows.length > 1 ? "s are" : " is"} missing required fields`,
          rows: lines,
        });
        return;
      }

      if (!parsed.length) {
        toast({ variant: "destructive", title: "No data found", description: "Make sure the sheet has data and a 'Registration Plate' column." });
        return;
      }

      let created = 0;
      setImportProgress({ current: 0, total: parsed.length });
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        try {
          const result = await FleetService.create({
            plate_number:     row.plate_number,
            vehicle_type:     row.vehicle_type as VehicleType,
            availability:     row.status as FleetStatus,
            is_active:        row.is_active as boolean,
            make:             row.make,
            model:            row.model,
            year:             row.year,
            color:            row.color,
            vin:              row.vin,
            fuel_type:        row.fuel_type,
            capacity_kg:      row.capacity_kg,
            odometer_km:      row.odometer_km,
            last_service_date: row.last_service_date,
            insurance_expiry:  row.insurance_expiry,
            inspection_expiry: row.inspection_expiry,
            allowed_license:   row.allowed_license,
            notes:             row.notes,
          }) as FleetVehicleEnriched;
          setVehicles((prev) => [result, ...prev]);
          created++;
        } catch { /* skip */ }
        setImportProgress({ current: i + 1, total: parsed.length });
      }
      setImportProgress(null);
      window.dispatchEvent(new Event("navcount:refresh"));
      toast({ title: "Import successful", description: `${created} of ${parsed.length} vehicle${parsed.length !== 1 ? "s" : ""} imported successfully.` });
    } catch {
      setImportProgress(null);
      toast({ variant: "destructive", title: "Import failed", description: "Failed to read the file. Please use a valid Excel file." });
    } finally {
      setImporting(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      setError(null);
      const data = await FleetService.getAll() as FleetVehicleEnriched[];
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (v: FleetVehicleEnriched) => {
    setEditing(v);
    setForm({
      plate_number:      v.plate_number,
      vehicle_type:      v.vehicle_type,
      make:              v.make ?? "",
      model:             v.model ?? "",
      year:              v.year != null ? String(v.year) : "",
      color:             v.color ?? "",
      vin:               v.vin ?? "",
      fuel_type:         v.fuel_type ?? "",
      capacity_kg:       v.capacity_kg != null ? String(v.capacity_kg) : "",
      odometer_km:       v.odometer_km != null ? String(v.odometer_km) : "",
      is_active:         v.is_active ?? true,
      availability:      v.availability ?? "available",
      last_service_date: isoToDisplay(v.last_service_date ?? ""),
      insurance_expiry:  isoToDisplay(v.insurance_expiry ?? ""),
      inspection_expiry: isoToDisplay(v.inspection_expiry ?? ""),
      allowed_license:   v.allowed_license
        ? v.allowed_license.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      notes:             v.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const toggleLicense = (val: string) => {
    setForm((f) => ({
      ...f,
      allowed_license: f.allowed_license.includes(val)
        ? f.allowed_license.filter((c) => c !== val)
        : [...f.allowed_license, val],
    }));
  };

  const handleSave = async () => {
    if (!form.plate_number.trim()) { setFormError("Registration plate is required."); return; }
    if (editing) {
      setPendingForm({ ...form });
      setConfirmUpdate(true);
      setModalOpen(false);
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      plate_number:      form.plate_number.toUpperCase().trim(),
      vehicle_type:      form.vehicle_type,
      make:              form.make.trim() || null,
      model:             form.model.trim() || null,
      year:              form.year ? Number(form.year) : null,
      color:             form.color.trim() || null,
      vin:               form.vin.trim() || null,
      fuel_type:         form.fuel_type || null,
      capacity_kg:       form.capacity_kg ? Number(form.capacity_kg) : null,
      odometer_km:       form.odometer_km ? Number(form.odometer_km) : null,
      is_active:         form.is_active,
      availability:      form.availability || "available",
      last_service_date: displayToIso(form.last_service_date) || null,
      insurance_expiry:  displayToIso(form.insurance_expiry) || null,
      inspection_expiry: displayToIso(form.inspection_expiry) || null,
      allowed_license:   form.allowed_license.length > 0 ? form.allowed_license.join(",") : null,
      notes:             form.notes || null,
    };
    try {
      const created = await FleetService.create(payload) as FleetVehicleEnriched;
      setVehicles((prev) => [created, ...prev]);
      toast({ title: "Vehicle added", description: `${payload.plate_number} has been added to the fleet.` });
      window.dispatchEvent(new Event("navcount:refresh"));
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const executeUpdate = async () => {
    if (!editing || !pendingForm) return;
    const f = pendingForm;
    const payload = {
      plate_number:      f.plate_number.toUpperCase().trim(),
      vehicle_type:      f.vehicle_type,
      make:              f.make.trim() || null,
      model:             f.model.trim() || null,
      year:              f.year ? Number(f.year) : null,
      color:             f.color.trim() || null,
      vin:               f.vin.trim() || null,
      fuel_type:         f.fuel_type || null,
      capacity_kg:       f.capacity_kg ? Number(f.capacity_kg) : null,
      odometer_km:       f.odometer_km ? Number(f.odometer_km) : null,
      is_active:         f.is_active,
      availability:      f.availability || "available",
      last_service_date: displayToIso(f.last_service_date) || null,
      insurance_expiry:  displayToIso(f.insurance_expiry) || null,
      inspection_expiry: displayToIso(f.inspection_expiry) || null,
      allowed_license:   f.allowed_license.length > 0 ? f.allowed_license.join(",") : null,
      notes:             f.notes || null,
    };
    try {
      const updated = await FleetService.update(editing.id, payload) as FleetVehicleEnriched;
      setVehicles((prev) => prev.map((v) => v.id === updated.id ? { ...updated, assigned_driver_name: editing.assigned_driver_name } : v));
      toast({ title: "Vehicle updated", description: `${payload.plate_number} has been updated successfully.` });
      window.dispatchEvent(new Event("navcount:refresh"));
    } catch (err) {
      toast({ variant: "destructive", title: "Update failed", description: err instanceof Error ? err.message : "Failed to update vehicle." });
    } finally {
      setConfirmUpdate(false);
      setPendingForm(null);
    }
  };

  const handleDelete = (v: FleetVehicleEnriched) => setDeleteTarget(v);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const name = deleteTarget.plate_number;
      await FleetService.delete(deleteTarget.id);
      setVehicles((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
      window.dispatchEvent(new Event("navcount:refresh"));
      setViewing(null);
      toast({ title: "Vehicle deleted", description: `${name} has been removed from the fleet.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete vehicle" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const tabCounts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: vehicles.length, active: 0, inactive: 0, available: 0, assigned: 0, in_maintenance: 0 };
    vehicles.forEach((v) => {
      if (v.is_active) {
        c.active++;
        if (v.availability in c) c[v.availability as FleetStatus]++;
      } else {
        c.inactive++;
      }
    });
    return c;
  }, [vehicles]);

  const filtered = useMemo(() => {
    let list =
      activeTab === "all"      ? vehicles :
      activeTab === "active"   ? vehicles.filter((v) => v.is_active) :
      activeTab === "inactive" ? vehicles.filter((v) => !v.is_active) :
      vehicles.filter((v) => v.is_active && v.availability === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        v.plate_number.toLowerCase().includes(q) ||
        v.vehicle_type.includes(q) ||
        (v.vin ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, activeTab, search]);

  const allFilteredSelected  = filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));
  const someFilteredSelected = filtered.some((v) => selectedIds.has(v.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filtered.every((v) => prev.has(v.id));
      if (allSelected) {
        const s = new Set(prev);
        filtered.forEach((v) => s.delete(v.id));
        return s;
      }
      const s = new Set(prev);
      filtered.forEach((v) => s.add(v.id));
      return s;
    });
  }, [filtered]);

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
      const ids = [...selectedIds];
      let deleted = 0;
      for (const id of ids) {
        try { await FleetService.delete(id); deleted++; } catch { /* skip */ }
      }
      setVehicles((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      setSelectedIds(new Set());
      window.dispatchEvent(new Event("navcount:refresh"));
      setBulkProcessing(false);
      toast({ title: "Deleted", description: `${deleted} vehicle${deleted !== 1 ? "s" : ""} removed from fleet.` });
    } else {
      const isActive = confirmBulkAction.type === "activate";
      let updated = 0;
      for (const id of selectedIds) {
        try {
          const result = await FleetService.update(id, { is_active: isActive, availability: isActive ? "available" : "in_maintenance" }) as FleetVehicleEnriched;
          setVehicles((prev) => prev.map((v) => v.id === result.id ? { ...result, assigned_driver_name: v.assigned_driver_name } : v));
          updated++;
        } catch { /* skip */ }
      }
      setSelectedIds(new Set());
      setBulkProcessing(false);
      toast({ title: isActive ? "Activated" : "Deactivated", description: `${updated} vehicle${updated !== 1 ? "s" : ""} ${isActive ? "activated" : "deactivated"}.` });
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-8 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Fleet Registry</h2>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onClick={fetchVehicles} loading={loading} />
            {/* Hidden file input */}
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />

            {/* Import */}
            <button
              onClick={() => setImportGuideOpen(true)}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {importing ? "Importing…" : "Import"}
            </button>

            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    <button onClick={exportExcel} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5">
                      <span className="text-base">📊</span> Excel (.xlsx)
                    </button>
                    <button onClick={exportPDF} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5 border-t border-gray-100">
                      <span className="text-base">📄</span> PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Add Vehicle */}
            <button
              onClick={openAdd}
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
              Add Vehicle
            </button>
          </div>
        </div>

        {/* Stat cards */}
        {!loading && !error && (
          <div className="px-8 pt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Vehicles",  value: vehicles.length          },
              { label: "Active",          value: tabCounts.active         },
              { label: "Inactive",        value: tabCounts.inactive       },
              { label: "Available",       value: tabCounts.available      },
              { label: "Assigned",        value: tabCounts.assigned       },
              { label: "In Maintenance",  value: tabCounts.in_maintenance },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-gray-100 bg-white px-4 py-3 flex flex-col gap-1 shadow-sm">
                <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                <span className="text-xs text-gray-500">{card.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search + tabs + view toggle */}
        {!loading && !error && (
          <div className="px-4 sm:px-8 pt-5 pb-4 space-y-2.5">
            {/* Row 1: search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by plate, type or VIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            {/* Row 2: Select-all + tabs + view toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                {/* Select-all checkbox */}
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
        {someFilteredSelected && (
          <div className="px-8 pb-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm text-sm">
              <span className="font-semibold text-gray-700">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-gray-200" />
              <button onClick={handleBulkDelete} disabled={bulkProcessing}
                className="font-medium text-red-600 hover:text-red-700 disabled:opacity-40 transition-colors">
                Delete
              </button>
              <button onClick={() => handleBulkSetActive(true)} disabled={bulkProcessing}
                className="font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40 transition-colors">
                Activate
              </button>
              <button onClick={() => handleBulkSetActive(false)} disabled={bulkProcessing}
                className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors">
                Deactivate
              </button>
              <button onClick={clearSelection}
                className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading vehicles...</p>
          </div>

        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <p className="text-sm font-medium text-red-600">Failed to load vehicles</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchVehicles}>Try again</Button>
          </div>

        ) : vehicles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="flex flex-col items-center gap-4 text-center rounded-2xl border border-dashed border-gray-200 w-full max-w-lg py-16 px-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <Truck className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">No vehicles yet</h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add your first vehicle to start building your fleet registry.
                </p>
              </div>
              <button
                onClick={openAdd}
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
                Add your first vehicle
              </button>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
            <p className="text-sm font-medium text-gray-700">No vehicles found</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>

        ) : viewMode === "list" ? (
          /* ── Table view ── */
          <div className="px-4 sm:px-8 pb-8 overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pt-1 pr-4 w-8" />
                  {["VEHICLE", "STATUS", "AVAILABILITY", "CAPACITY", "FUEL", "DRIVER", "LICENSE", "ACTIONS"].map((h) => (
                    <th key={h} className="pb-3 pt-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide pr-4 first:pl-0 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((vehicle) => {
                  const licenses = vehicle.allowed_license
                    ? vehicle.allowed_license.split(",").map((c) => c.trim()).filter(Boolean)
                    : [];
                  return (
                    <tr key={vehicle.id} className={`transition-colors ${selectedIds.has(vehicle.id) ? "bg-emerald-50/60" : "hover:bg-gray-50/50"}`}>
                      {/* Checkbox */}
                      <td className="py-3.5 pr-4">
                        <button
                          onClick={() => toggleSelect(vehicle.id)}
                          className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                            selectedIds.has(vehicle.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                          }`}
                        >
                          {selectedIds.has(vehicle.id) && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                      {/* Vehicle */}
                      <td className="py-3.5 pr-4">
                        <button onClick={() => setViewing(vehicle)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
                          <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-emerald-600">
                            <VehicleIcon type={vehicle.vehicle_type} className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{vehicle.plate_number}</p>
                            <p className="text-xs text-gray-400">{VEHICLE_TYPE_LABEL[vehicle.vehicle_type] ?? vehicle.vehicle_type}</p>
                          </div>
                        </button>
                      </td>
                      {/* Status */}
                      <td className="py-3.5 pr-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${vehicle.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {vehicle.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {/* Availability */}
                      <td className="py-3.5 pr-4">
                        {vehicle.is_active ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${STATUS_STYLE[vehicle.availability as FleetStatus] ?? "bg-gray-100 text-gray-500"}`}>
                            {STATUS_LABEL[vehicle.availability as FleetStatus] ?? vehicle.availability}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      {/* Capacity */}
                      <td className="py-3.5 pr-4 text-sm text-gray-700 whitespace-nowrap">
                        {vehicle.capacity_kg != null ? `${vehicle.capacity_kg} kg` : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Fuel */}
                      <td className="py-3.5 pr-4 text-sm text-gray-700 capitalize whitespace-nowrap">
                        {vehicle.fuel_type ?? <span className="text-gray-300">—</span>}
                      </td>
                      {/* Driver */}
                      <td className="py-3.5 pr-4 text-sm whitespace-nowrap">
                        {vehicle.assigned_driver_name
                          ? <span className="font-medium text-gray-800">{vehicle.assigned_driver_name}</span>
                          : <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      {/* License */}
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {licenses.length > 0
                            ? licenses.map((c) => (
                                <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{c}</span>
                              ))
                            : <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </td>
                      {/* Actions — icons only */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setViewing(vehicle)} title="View"
                            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(vehicle)} title="Edit"
                            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(vehicle)} title="Delete"
                            disabled={deletingId === vehicle.id}
                            className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : (
          /* ── Card / Grid view ── */
          <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((vehicle) => {
              const licenses = vehicle.allowed_license
                ? vehicle.allowed_license.split(",").map((c) => c.trim()).filter(Boolean)
                : [];
              return (
                <div key={vehicle.id} className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow flex flex-col ${selectedIds.has(vehicle.id) ? "border-emerald-400 ring-1 ring-emerald-300" : "border-gray-200"}`}>

                  {/* Header */}
                  <div className="relative px-4 pt-4 pb-3">
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <button
                        onClick={() => openEdit(vehicle)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title="Edit vehicle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete vehicle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleSelect(vehicle.id)}
                        className={`flex items-center justify-center h-5 w-5 rounded border transition-colors ${
                          selectedIds.has(vehicle.id) ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white hover:border-emerald-400"
                        }`}
                      >
                        {selectedIds.has(vehicle.id) && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pr-16">
                      <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-emerald-600">
                        <VehicleIcon type={vehicle.vehicle_type} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate leading-tight">{vehicle.plate_number}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{VEHICLE_TYPE_LABEL[vehicle.vehicle_type] ?? vehicle.vehicle_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${vehicle.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {vehicle.is_active ? "Active" : "Inactive"}
                      </span>
                      {vehicle.is_active && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${STATUS_STYLE[vehicle.availability as FleetStatus] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABEL[vehicle.availability as FleetStatus] ?? vehicle.availability}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="border-t px-5 py-4 space-y-2.5 text-sm text-gray-600">
                    {vehicle.capacity_kg != null && (
                      <div className="flex items-center gap-2.5">
                        <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>Capacity: <span className="font-semibold text-gray-800">{vehicle.capacity_kg} kg</span></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      {vehicle.assigned_driver_name
                        ? <span>Assigned to: <span className="font-semibold text-gray-800">{vehicle.assigned_driver_name}</span></span>
                        : <span className="text-gray-400 italic">No driver assigned</span>
                      }
                    </div>
                    {vehicle.fuel_type && (
                      <div className="flex items-center gap-2.5">
                        <Fuel className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="capitalize">{vehicle.fuel_type}</span>
                      </div>
                    )}
                    {licenses.length > 0 && (
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {licenses.map((c) => (
                            <span key={c} className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="border-t grid grid-cols-2 gap-3 p-3 mt-auto">
                    <button
                      onClick={() => setViewing(vehicle)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={() => openEdit(vehicle)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editing ? "Edit Vehicle" : "Add Vehicle"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editing ? "Update vehicle details." : "Register a new vehicle to your fleet."}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">

              {/* Row 1: Plate + Vehicle Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Registration Plate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., KCA 123A"
                    value={form.plate_number}
                    onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 uppercase placeholder:normal-case"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value as VehicleType }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Make + Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Make</label>
                  <input
                    type="text"
                    placeholder="e.g., Toyota"
                    value={form.make}
                    onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Model</label>
                  <input
                    type="text"
                    placeholder="e.g., Hilux"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 3: Year + Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Year</label>
                  <input
                    type="number"
                    placeholder="e.g., 2020"
                    min={1900}
                    max={new Date().getFullYear() + 1}
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Color</label>
                  <input
                    type="text"
                    placeholder="e.g., White"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 4: VIN + Fuel Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">VIN</label>
                  <input
                    type="text"
                    placeholder="Vehicle Identification Number"
                    value={form.vin}
                    onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Fuel Type</label>
                  <select
                    value={form.fuel_type}
                    onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Select fuel type...</option>
                    {FUEL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Capacity + Odometer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Capacity (kg)</label>
                  <input
                    type="number"
                    placeholder="e.g., 500"
                    value={form.capacity_kg}
                    onChange={(e) => setForm((f) => ({ ...f, capacity_kg: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Odometer Reading (km)</label>
                  <input
                    type="number"
                    placeholder="e.g., 45000"
                    value={form.odometer_km}
                    onChange={(e) => setForm((f) => ({ ...f, odometer_km: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 6: Status + Vehicle Availability */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Status <span className="text-red-500">*</span></label>
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(e) => {
                      const active = e.target.value === "active";
                      setForm((f) => ({
                        ...f,
                        is_active: active,
                        availability: active ? f.availability : "in_maintenance",
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={`text-sm font-medium mb-1.5 block ${form.is_active ? "text-gray-700" : "text-gray-400"}`}>
                    Vehicle Availability <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.availability}
                    onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                    disabled={!form.is_active}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                  >
                    <option value="available">Available</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_maintenance">In Maintenance</option>
                  </select>
                  {!form.is_active && (
                    <p className="mt-1 text-xs text-gray-400">Not applicable for inactive vehicles</p>
                  )}
                </div>
              </div>

              {/* Row 7: Last Service Date + Insurance Expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Last Service Date</label>
                  <DatePickerInput
                    value={form.last_service_date}
                    onChange={(v) => setForm((f) => ({ ...f, last_service_date: v }))}
                    className="w-full rounded-lg border border-gray-200 px-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Insurance Expiry</label>
                  <DatePickerInput
                    value={form.insurance_expiry}
                    onChange={(v) => setForm((f) => ({ ...f, insurance_expiry: v }))}
                    className="w-full rounded-lg border border-gray-200 px-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 8: Inspection Expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Inspection Expiry</label>
                  <DatePickerInput
                    value={form.inspection_expiry}
                    onChange={(v) => setForm((f) => ({ ...f, inspection_expiry: v }))}
                    className="w-full rounded-lg border border-gray-200 px-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Allowed License Classes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Allowed Driving License
                  <span className="ml-2 text-xs font-normal text-gray-400">Select required license class(es)</span>
                </label>
                <div className="rounded-lg border border-gray-200 p-3 grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {LICENSE_CLASSES.map((lc) => {
                    const checked = form.allowed_license.includes(lc.value);
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
                          onChange={() => toggleLicense(lc.value)}
                          className="accent-emerald-700 h-3.5 w-3.5 shrink-0"
                        />
                        <span className="leading-tight">{lc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes about this vehicle..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                Driver assignment is managed from the Drivers page and updates status automatically.
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 20px", fontSize: 14, fontWeight: 600,
                  color: "#162318", backgroundColor: saving ? "#bfe96f" : "#CDF782",
                  border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f"; }}
                onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782"; }}
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      <FleetViewModal
        vehicle={viewing}
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        onEdit={() => { setViewing(null); openEdit(viewing!); }}
        onDelete={() => handleDelete(viewing!)}
      />

      {/* Import progress */}
      {importProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 px-8 py-8">
            <div className="flex justify-center mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                <Upload className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div className="text-center mb-6">
              <h3 className="text-sm font-semibold text-gray-900">Importing vehicles…</h3>
              <p className="mt-1 text-xs text-gray-400">{importProgress.current} of {importProgress.total} row{importProgress.total !== 1 ? "s" : ""} processed</p>
            </div>
            <div className="w-full rounded-full bg-gray-100 h-2.5 overflow-hidden">
              <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`, backgroundColor: "#CDF782" }} />
            </div>
            <p className="mt-2 text-right text-xs font-semibold text-gray-500">{Math.round((importProgress.current / importProgress.total) * 100)}%</p>
          </div>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setImportError(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-red-100 bg-red-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-red-200">
                  <X className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-700">Upload Failed</h3>
                  <p className="text-xs text-red-500 mt-0.5">{importError.title}</p>
                </div>
              </div>
              <button onClick={() => setImportError(null)} className="shrink-0 text-red-400 hover:text-red-600 rounded-md p-1 hover:bg-red-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs text-gray-500">The following rows have missing required fields:</p>
              <div className="rounded-xl border border-red-100 bg-red-50 divide-y divide-red-100 max-h-52 overflow-y-auto">
                {importError.rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-xs text-red-700">{row}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">Please update your file with the missing values and try uploading again.</p>
            </div>
            <div className="px-6 pb-6 pt-1">
              <button
                onClick={() => setImportError(null)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#162318", backgroundColor: "#CDF782", border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
              >
                Got it, I'll fix the file
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className="text-sm font-semibold text-red-600">
                Do you want to delete {deleteTarget.plate_number}?
              </h3>
              <button onClick={() => setDeleteTarget(null)} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm update modal */}
      {confirmUpdate && pendingForm && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setConfirmUpdate(false); setPendingForm(null); }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Do you want to update {editing.plate_number}?
              </h3>
              <button onClick={() => { setConfirmUpdate(false); setPendingForm(null); }} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => { setConfirmUpdate(false); setPendingForm(null); }}
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
                  ? `Do you want to delete ${confirmBulkAction.count} vehicle${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : confirmBulkAction.type === "activate"
                  ? `Do you want to activate ${confirmBulkAction.count} vehicle${confirmBulkAction.count !== 1 ? "s" : ""}?`
                  : `Do you want to deactivate ${confirmBulkAction.count} vehicle${confirmBulkAction.count !== 1 ? "s" : ""}?`}
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
                  confirmBulkAction.type === "delete" ? "bg-red-500 hover:bg-red-600 text-white" : ""
                }`}
                style={confirmBulkAction.type !== "delete" ? { backgroundColor: "#CDF782", color: "#162318" } : undefined}
              >
                {bulkProcessing ? "Processing…" : confirmBulkAction.type === "delete" ? "Delete" : confirmBulkAction.type === "activate" ? "Activate" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import guide */}
      {importGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setImportGuideOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl mx-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                  <Upload className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Import Vehicles</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Prepare your Excel file using the format below</p>
                </div>
              </div>
              <button onClick={() => setImportGuideOpen(false)} className="shrink-0 text-gray-400 hover:text-gray-600 rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                <span className="text-base">📋</span>
                <p className="text-xs text-blue-700">Accepted file types: <strong>.xlsx</strong> or <strong>.xls</strong>. The first sheet will be used.</p>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Column Name</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Accepted Values / Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { name: "Registration Plate",   req: true,  example: "KCA 123A" },
                      { name: "Vehicle Type",         req: true,  example: "motorbike / bicycle / car / van / truck / other" },
                      { name: "Status",               req: true,  example: "Active / Inactive" },
                      { name: "Vehicle Availability", req: true,  example: "available / assigned / in maintenance" },
                      { name: "Make",               req: false, example: "Toyota" },
                      { name: "Model",              req: false, example: "Hilux" },
                      { name: "Year",               req: false, example: "2020" },
                      { name: "Color",              req: false, example: "White" },
                      { name: "VIN",                req: false, example: "JT123456789" },
                      { name: "Fuel Type",          req: false, example: "petrol / diesel / electric / hybrid / cng / other" },
                      { name: "Capacity (kg)",      req: false, example: "500" },
                      { name: "Odometer Reading (km)", req: false, example: "45000" },
                      { name: "Last Service Date",  req: false, example: "2024-06-01" },
                      { name: "Insurance Expiry",   req: false, example: "2025-12-31" },
                      { name: "Inspection Expiry",  req: false, example: "2025-06-30" },
                      { name: "Allowed Driving License", req: false, example: "B1,B2" },
                      { name: "Notes",              req: false, example: "Any additional notes" },
                    ].map((col) => (
                      <tr key={col.name}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{col.name}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {col.req
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Required</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"><span className="h-1.5 w-1.5 rounded-full bg-gray-300 inline-block" />Optional</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 italic">{col.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                <span className="text-base mt-0.5">💡</span>
                <p className="text-xs text-amber-700">Column names must match exactly as shown. Rows missing <strong>Registration Plate</strong>, <strong>Vehicle Type</strong>, <strong>Status</strong>, or <strong>Vehicle Availability</strong> will cause the entire upload to be rejected.</p>
              </div>
            </div>
            <div className="px-6 pb-6 pt-1 flex gap-2">
              <button
                onClick={() => { setImportGuideOpen(false); importRef.current?.click(); }}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#162318", backgroundColor: "#CDF782", border: "none", borderRadius: 10, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#bfe96f")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CDF782")}
              >
                <Upload className="h-4 w-4" /> Browse File
              </button>
              <button onClick={() => setImportGuideOpen(false)} className="flex-1 rounded-[10px] border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 py-2.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
