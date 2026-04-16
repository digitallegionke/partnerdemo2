"use client";

import { useState, useEffect } from "react";
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import {
  Plus,
  Edit,
  Phone,
  Mail,
  MapPin,
  Star,
  MoreVertical,
  Download,
  Search,
  User,
  Truck,
  Activity,
  RefreshCw,
  AlertCircle,
  X,
  Upload,
  FileText,
  Copy,
  CheckCircle2,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentBase,
  AlertDialogDescription as AlertDialogDescriptionBase,
  AlertDialogFooter,
  AlertDialogHeader as AlertDialogHeaderBase,
  AlertDialogTitle as AlertDialogTitleBase,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DriverService } from "@/lib/services/drivers";
import { toast } from "@/hooks/use-toast";

// Transform Supabase driver data to UI format
const transformDriverForUI = (driver: any) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getLocationFromVehicle = (vehicleType: string) => {
    // Default locations based on vehicle type - this could be enhanced
    const locations = {
      Motorcycle: "HQ",
      Van: "HQ",
      Truck: "HQ",
    };
    return locations[vehicleType as keyof typeof locations] || "Nairobi";
  };

  const formatDate = (dateString: string) => {
    return dateString.split("T")[0];
  };

  const mapStatus = (status: string) => {
    switch (status) {
      case "on_break":
        return "busy";
      case "inactive":
        return "offline";
      default:
        return status;
    }
  };

  return {
    id: driver.id,
    name: driver.name,
    email: driver.email || `no email provided`,
    phone: driver.phone,
    status: mapStatus(driver.status),
    location: getLocationFromVehicle(driver.vehicle_type),
    vehicle: `${driver.vehicle_type} - ${driver.license_number}`,
    rating: 4.9,
    totalDeliveries: driver.deliveries?.[0]?.count || 0,
    completedToday: driver.status === "active" ? 1 : 0,
    joinDate: formatDate(driver.created_at),
    avatar: driver.avatar || getInitials(driver.name),
    lastActive:
      driver.status === "active"
        ? `${Math.floor(Math.random() * 30) + 1}m ago`
        : driver.status === "on_break"
        ? `${Math.floor(Math.random() * 2) + 1}h ago`
        : `${Math.floor(Math.random() * 24) + 1}h ago`,
    efficiency: Math.floor(Math.random() * 15) + 85, // Random between 85-100%
  };
};

export default function DriversScreen() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callingDriver, setCallingDriver] = useState<any>(null);
  const [driverId, setDriverId] = useState(0);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // OTP Success Modal state
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [createdDriverOtp, setCreatedDriverOtp] = useState<{
    name: string;
    phone: string;
    otp: string;
  } | null>(null);
  const [otpCopied, setOtpCopied] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    busy: 0,
    offline: 0,
    avgRating: 0,
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    vehicle_type: "",
    license_number: "",
    status: "active",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importProgress, setImportProgress] = useState({
    total: 0,
    completed: 0,
    skipped: 0,
    isProcessing: false,
  });

  // Load drivers from Supabase
  const loadDrivers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DriverService.getAllDrivers();
      const transformedDrivers = data.map(transformDriverForUI);
      setDrivers(transformedDrivers);

      // Calculate stats
      const newStats = {
        total: transformedDrivers.length,
        active: transformedDrivers.filter((d) => d.status === "active").length,
        busy: transformedDrivers.filter((d) => d.status === "busy").length,
        offline: transformedDrivers.filter((d) => d.status === "offline")
          .length,
        avgRating:
          transformedDrivers.length > 0
            ? Math.round(
                (transformedDrivers.reduce((sum, d) => sum + d.rating, 0) /
                  transformedDrivers.length) *
                  10
              ) / 10
            : 0,
      };
      setStats(newStats);
    } catch (err) {
      console.error("Error loading drivers:", err);
      setError("Failed to load drivers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load drivers on component mount
  useEffect(() => {
    loadDrivers();
  }, []);

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^\+?[\d\s-]{10,}$/.test(formData.phone.trim())) {
      errors.phone = "Please enter a valid phone number";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.vehicle_type) {
      errors.vehicle_type = "Vehicle type is required";
    }

    if (!formData.license_number.trim()) {
      errors.license_number = "License number is required";
    } else if (formData.license_number.trim().length < 3) {
      errors.license_number = "License number must be at least 3 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      vehicle_type: "",
      license_number: "",
      status: "active",
    });
    setFormErrors({});
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEditModalOpen) {
        setIsEditModalOpen(false);

        resetForm();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isEditModalOpen]);

  // Handle update driver

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const driverData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type,
        license_number: formData.license_number,
        status: "active" as const,
      };

      const result = await DriverService.createDriver(driverData);

      // Close add dialog
      setIsAddDialogOpen(false);

      // If we have a setup OTP, show the success modal
      if (result.setupOtp) {
        setCreatedDriverOtp({
          name: formData.name,
          phone: formData.phone,
          otp: result.setupOtp,
        });
        setIsOtpModalOpen(true);
      } else {
        toast({
          title: "Driver created successfully",
          description: `${formData.name} has been added to your team.`,
        });
      }

      // Reset form
      resetForm();

      // Refresh drivers list
      await loadDrivers();
    } catch (error: any) {
      console.error("Error creating driver:", error);
      toast({
        title: "Failed to create driver",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (driver: any) => {
    setFormData({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      vehicle_type: driver.vehicle.split(" - ")[0],
      license_number: driver.vehicle.split(" - ")[1],
      status: driver.status,
    });
    setDriverId(driver.id);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteDialog = (driver: any) => {
    setDriverToDelete(driver);
    setIsDeleteDialogOpen(true);
  };

  const handleRegenerateOtp = async (driver: any) => {
    try {
      const result = await DriverService.regenerateSetupOtp(driver.id);

      // Show the OTP modal with the regenerated code
      setCreatedDriverOtp({
        name: driver.name,
        phone: driver.phone,
        otp: result.setupOtp,
      });
      setIsOtpModalOpen(true);

      toast({
        title: "Setup code regenerated",
        description: `New setup code generated for ${driver.name}`,
      });
    } catch (error: any) {
      console.error("Error regenerating OTP:", error);
      toast({
        title: "Failed to regenerate code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setDriverToDelete(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!driverToDelete) return;

    setIsDeleting(true);

    try {
      await DriverService.deleteDriver(driverToDelete.id);
      toast({ title: "Driver deleted successfully" });
      handleDeleteDialogChange(false);
      await loadDrivers();
    } catch (error) {
      console.error("Error deleting driver:", error);
      toast({
        title: "Failed to delete driver",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const driverData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type,
        license_number: formData.license_number,
        status: "active" as const,
      };

      await DriverService.updateDriver(driverId, driverData);

      // Reset form and close dialog
      resetForm();
      setIsEditModalOpen(false);

      // Refresh drivers list
      await loadDrivers();
    } catch (error) {
      console.error("Error creating driver:", error);
      // TODO: Show error toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCall = (driver: any) => {
    // Detect if user is on mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768;

    if (isMobile) {
      // Use device's native phone app
      const phoneNumber = driver.phone.replace(/[^\d+]/g, ""); // Clean phone number
      window.location.href = `tel:${phoneNumber}`;

      toast({
        title: "Opening phone app",
        description: `Calling ${driver.name} at ${driver.phone}`,
      });
    } else {
      setCallingDriver(driver);
      setIsCallModalOpen(true);
    }
  };

  const copyPhoneNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({
        title: "Phone number copied",
        description: `${phone} has been copied to clipboard`,
      });
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 5000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy phone number to clipboard",
        variant: "destructive",
      });
      setPhoneCopied(false);
    }
  };

  const copyOtp = async (otp: string) => {
    try {
      await navigator.clipboard.writeText(otp);
      toast({
        title: "OTP copied",
        description: "Setup code copied to clipboard",
      });
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 3000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy OTP to clipboard",
        variant: "destructive",
      });
    }
  };

  const parseCSVLine = (line: string): string[] => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
      cleanLine = cleanLine.slice(1, -1);
    }

    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < cleanLine.length; i++) {
      const char = cleanLine[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim().replace(/^["']|["']$/g, ""));
    return result;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "text/csv") {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setImportProgress({
      total: 0,
      completed: 0,
      skipped: 0,
      isProcessing: true,
    });

    try {
      const text = await file.text();

      const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = normalizedText.split("\n").filter((line) => line.trim());

      const headerValues = parseCSVLine(lines[0]);
      const headers = headerValues.map((h) => h.toLowerCase().trim());

      const requiredHeaders = ["name", "phone", "vehicle_type", "license_number"];
      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header)
      );

      if (missingHeaders.length > 0) {
        toast({
          title: "Invalid CSV format",
          description: `Missing required columns: ${missingHeaders.join(
            ", "
          )}. Found: ${headers.join(", ")}`,
          variant: "destructive",
        });
        setIsUploading(false);
        setImportProgress({
          total: 0,
          completed: 0,
          skipped: 0,
          isProcessing: false,
        });
        return;
      }

      const newDrivers = [];
      const skippedRows: number[] = [];
      const totalRows = lines.length - 1;
      setImportProgress((prev) => ({ ...prev, total: totalRows }));

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        const name = values[headers.indexOf("name")] || "";
        const phone = values[headers.indexOf("phone")] || "";
        const vehicle_type = values[headers.indexOf("vehicle_type")] || "";
        const license_number = values[headers.indexOf("license_number")] || "";
        const email =
          headers.includes("email") && values[headers.indexOf("email")]
            ? values[headers.indexOf("email")]
            : null;

        // Validate required fields
        if (!name || !phone || !vehicle_type || !license_number) {
          console.warn(`Missing required fields at row ${i + 1}`);
          skippedRows.push(i + 1);
          setImportProgress((prev) => ({
            ...prev,
            skipped: prev.skipped + 1,
          }));
          continue;
        }

        const driver = {
          name: name,
          email: email,
          phone: phone,
          vehicle_type: vehicle_type,
          license_number: license_number,
          status: "active" as const,
        };

        try {
          await DriverService.createDriver(driver);
          newDrivers.push(driver);
          setImportProgress((prev) => ({
            ...prev,
            completed: prev.completed + 1,
          }));
        } catch (error) {
          console.error(`Failed to create driver at row ${i + 1}:`, error);
          skippedRows.push(i + 1);
          setImportProgress((prev) => ({
            ...prev,
            skipped: prev.skipped + 1,
          }));
        }

        // Add a small delay to avoid rate limits
        if (i < lines.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      toast({
        title: "Import completed",
        description: `Successfully imported ${
          newDrivers.length
        } drivers.${
          skippedRows.length > 0
            ? ` ${skippedRows.length} row(s) were skipped (rows: ${skippedRows.slice(0, 5).join(", ")}${
                skippedRows.length > 5 ? "..." : ""
              }).`
            : ""
        }`,
      });
      setIsImportOpen(false);
      setImportProgress({
        total: 0,
        completed: 0,
        skipped: 0,
        isProcessing: false,
      });
      await loadDrivers();
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast({
        title: "Import failed",
        description: "Failed to parse CSV file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    const message = encodeURIComponent(
      `Hi ${name}, this is regarding your delivery services.`
    );
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    window.open(whatsappUrl, "_blank");

    toast({
      title: "Opening WhatsApp",
      description: `Starting conversation with ${name}`,
    });
  };

  const filteredDrivers = drivers.filter((driver: any) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone.includes(searchTerm);
    const matchesStatus =
      filterStatus === "all" || driver.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200";
      case "busy":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "offline":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "busy":
        return "bg-orange-500";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  // Helper component for form field errors
  const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null;
    return (
      <p className="text-sm text-red-600 mt-1 flex items-center">
        <AlertCircle className="h-3 w-3 mr-1" />
        {error}
      </p>
    );
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-6 relative" style={{ backgroundColor: '#EFF0EB' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                Drivers
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Manage your delivery team and assignments
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDrivers}
                className="text-gray-600 text-xs sm:text-sm"
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-gray-600 text-xs sm:text-sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gray-600 text-xs sm:text-sm"
                  >
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md mx-4 sm:mx-0">
                  <DialogHeader>
                    <DialogTitle>Import Drivers</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file to add multiple drivers at once.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {!importProgress.isProcessing ? (
                      <>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 mb-2">
                            Choose a CSV file to import
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            Required columns: name, phone, vehicle_type, license_number
                          </p>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="hidden"
                            id="driver-csv-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              document
                                .getElementById("driver-csv-upload")
                                ?.click()
                            }
                            disabled={isUploading}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Select CSV File
                          </Button>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-900 mb-2 font-medium">
                            Sample CSV Format
                          </p>
                          <p className="text-xs text-blue-700 mb-2">
                            Download our sample CSV to see the required format:
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = "/sample-drivers.csv";
                              link.download = "sample-drivers.csv";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="h-3 w-3 mr-2" />
                            Download Sample CSV
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              Importing drivers...
                            </span>
                            <span className="text-sm text-gray-600">
                              {importProgress.completed} / {importProgress.total}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#C8E298] h-2 rounded-full transition-all duration-300"
                              style={{
                                width:
                                  importProgress.total > 0
                                    ? `${
                                        (importProgress.completed /
                                          importProgress.total) *
                                        100
                                      }%`
                                    : "0%",
                              }}
                            ></div>
                          </div>
                        </div>
                        {importProgress.skipped > 0 && (
                          <p className="text-sm text-orange-600">
                            Skipped: {importProgress.skipped} row(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="default"
                    className="text-sm sm:text-sm px-4 py-2 h-10 sm:h-9"
                  >
                    <Plus className="h-4 w-4 sm:h-4 sm:w-4 mr-2 sm:mr-2" />
                    <span className="hidden sm:inline">Add Driver</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md mx-4 sm:mx-0">
                  <DialogHeader>
                    <DialogTitle>Add Driver</DialogTitle>
                    <DialogDescription>
                      Add a new driver to your team.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="driverName">Name *</Label>
                      <Input
                        id="driverName"
                        placeholder="Enter driver name"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        className={
                          formErrors.name
                            ? "border-red-500 focus:border-red-500"
                            : ""
                        }
                        required
                      />
                      <FieldError error={formErrors.name} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="driver@roundi.com"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        className={
                          formErrors.email
                            ? "border-red-500 focus:border-red-500"
                            : ""
                        }
                      />
                      <FieldError error={formErrors.email} />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <PhoneInput
                        placeholder="+254 7XX XXX XXX"
                        defaultCountry="us"
                        value={formData.phone}
                        disabled={false}
                        onChange={(value) =>
                          handleInputChange("phone", value)
                        }
                        required
                      />
                      <FieldError error={formErrors.phone} />
                    </div>
                    <div>
                      <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                      <Select
                        value={formData.vehicle_type}
                        onValueChange={(value) =>
                          handleInputChange("vehicle_type", value)
                        }
                      >
                        <SelectTrigger
                          className={
                            formErrors.vehicle_type
                              ? "border-red-500 focus:border-red-500"
                              : ""
                          }
                        >
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="Van">Van</SelectItem>
                          <SelectItem value="Truck">Truck</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={formErrors.vehicle_type} />
                    </div>
                    <div>
                      <Label htmlFor="license_number">License Number *</Label>
                      <Input
                        id="license_number"
                        placeholder="KCA123D"
                        value={formData.license_number}
                        onChange={(e) =>
                          handleInputChange("license_number", e.target.value)
                        }
                        className={
                          formErrors.license_number
                            ? "border-red-500 focus:border-red-500"
                            : ""
                        }
                        required
                      />
                      <FieldError error={formErrors.license_number} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setIsAddDialogOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Adding..." : "Add Driver"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm sm:text-base"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Total</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                    {stats.total}
                  </p>
                </div>
                <User className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Active</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-green-600">
                    {stats.active}
                  </p>
                </div>
                <Activity className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    On Delivery
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-orange-600">
                    {stats.busy}
                  </p>
                </div>
                <Truck className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Avg Rating</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                    {stats.avgRating}
                  </p>
                </div>
                <Star className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading drivers...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error loading drivers
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadDrivers}>Try Again</Button>
          </div>
        )}

        {/* Drivers Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredDrivers.map((driver) => (
              <Card
                key={driver.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gray-100 text-gray-700 text-sm">
                            {driver.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusDot(
                            driver.status
                          )}`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base text-gray-900">
                          {driver.name}
                        </CardTitle>
                        <Badge
                          className={`${getStatusColor(
                            driver.status
                          )} text-xs mt-1`}
                          variant="outline"
                        >
                          {driver.status === "busy"
                            ? "On delivery"
                            : driver.status}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(driver)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRegenerateOtp(driver)}>
                          <Key className="h-4 w-4 mr-2" />
                          Regenerate Setup Code
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleOpenDeleteDialog(driver)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Contact Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{driver.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{driver.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{driver.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck className="h-4 w-4" />
                      <span className="truncate">{driver.vehicle}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Deliveries</p>
                      <p className="font-medium text-gray-900">
                        {driver.totalDeliveries}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rating</p>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        <span className="font-medium text-gray-900">
                          {driver.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500">Today</p>
                      <p className="font-medium text-gray-900">
                        {driver.completedToday}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last active</p>
                      <p className="font-medium text-gray-900">
                        {driver.lastActive}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleEdit(driver)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[#C8E298] hover:bg-[#A8C278] text-[#162318]"
                      onClick={() => handleCall(driver)}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Modal*/}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Driver: {formData.name}</DialogTitle>
              <DialogDescription>Update driver information.</DialogDescription>
            </DialogHeader>
            {formData && (
              <form onSubmit={handleUpdateDriver} className="space-y-4">
                <div>
                  <Label htmlFor="driverName">Name *</Label>
                  <Input
                    id="driverName"
                    placeholder="Enter driver name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                    className={
                      formErrors.name
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }
                  />
                  <FieldError error={formErrors.name} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="driver@roundi.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={
                      formErrors.email
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }
                  />
                  <FieldError error={formErrors.email} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number*</Label>
                  <PhoneInput
                    placeholder="+254 7XX XXX XXX"
                    defaultCountry="us"
                    value={formData.phone}  
                    onChange={(value) => handleInputChange("phone", value)}
                    required
                    className={
                      formErrors.phone
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }
                  />
                  <FieldError error={formErrors.phone} />
                </div>
                <div>
                  <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                  <Select
                    value={formData.vehicle_type}
                    onValueChange={(value) =>
                      handleInputChange("vehicle_type", value)
                    }
                  >
                    <SelectTrigger
                      className={
                        formErrors.vehicle_type
                          ? "border-red-500 focus:border-red-500"
                          : ""
                      }
                    >
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="Van">Van</SelectItem>
                      <SelectItem value="Truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError error={formErrors.vehicle_type} />
                </div>
                <div>
                  <Label htmlFor="license_number">License Number *</Label>
                  <Input
                    id="license_number"
                    placeholder="KCA123D"
                    value={formData.license_number}
                    onChange={(e) => {
                      handleInputChange("license_number", e.target.value);
                    }}
                    className={
                      formErrors.license_number
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }
                    required
                  />
                  <FieldError error={formErrors.license_number} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsEditModalOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !formData.name ||
                      !formData.phone ||
                      !formData.vehicle_type ||
                      !formData.license_number
                    }
                  >
                    Update Driver
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={handleDeleteDialogChange}
        >
          <AlertDialogContentBase>
            <AlertDialogHeaderBase>
              <AlertDialogTitleBase>Delete Driver</AlertDialogTitleBase>
              <AlertDialogDescriptionBase>
                Are you sure you want to delete {driverToDelete?.name}? This
                action cannot be undone.
              </AlertDialogDescriptionBase>
            </AlertDialogHeaderBase>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 focus:ring-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContentBase>
        </AlertDialog>
        {/* Call Modal*/}
        <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-center">Contact Driver</DialogTitle>
            </DialogHeader>
            {callingDriver && (
              <div className="space-y-6 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={callingDriver.avatar || "/placeholder.svg"}
                    />
                    <AvatarFallback className="bg-gray-100 text-gray-700 text-xl">
                      {callingDriver.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {callingDriver.name}
                    </h3>
                    <p className="text-gray-600">{callingDriver.phone}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => copyPhoneNumber(callingDriver.phone)}
                    variant="outline"
                    className="w-full"
                  >
                    {phoneCopied ? (
                      <>
                        <svg
                          className="h-4 w-4 mr-2"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4 mr-2" />
                        Copy Phone Number
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() =>
                      openWhatsApp(callingDriver.phone, callingDriver.name)
                    }
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <svg
                      className="h-4 w-4 mr-2"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                    </svg>
                    Open WhatsApp
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setIsCallModalOpen(false)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* OTP Success Modal - Shows after driver creation with setup OTP */}
        <Dialog open={isOtpModalOpen} onOpenChange={setIsOtpModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Driver Created Successfully
              </DialogTitle>
              <DialogDescription>
                Share this one-time setup code with {createdDriverOtp?.name} to activate their account in the driver app.
              </DialogDescription>
            </DialogHeader>
            {createdDriverOtp && (
              <div className="space-y-6">
                {/* Driver Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{createdDriverOtp.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{createdDriverOtp.phone}</span>
                  </div>
                </div>

                {/* OTP Display */}
                <div className="border-2 border-dashed border-[#C8E298] rounded-lg p-6 text-center bg-[#F8FBF4]">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Key className="h-5 w-5 text-[#5A7A32]" />
                    <span className="text-sm font-medium text-[#5A7A32]">One-Time Setup Code</span>
                  </div>
                  <div className="text-4xl font-mono font-bold tracking-[0.3em] text-gray-900 mb-4">
                    {createdDriverOtp.otp}
                  </div>
                  <Button
                    onClick={() => copyOtp(createdDriverOtp.otp)}
                    variant="outline"
                    className="w-full"
                  >
                    {otpCopied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Code
                      </>
                    )}
                  </Button>
                </div>

                {/* Important Notes */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Important:</strong> This code can only be used once and expires in 7 days.
                    The driver should enter this code in the mobile app to activate their account.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsOtpModalOpen(false);
                      setCreatedDriverOtp(null);
                      setOtpCopied(false);
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      const message = `Hi ${createdDriverOtp.name}! Your Roundi driver account has been created. Use this one-time setup code to activate your account in the driver app: ${createdDriverOtp.otp}`;
                      const cleanPhone = createdDriverOtp.phone.replace(/[^\d+]/g, "");
                      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <svg
                      className="h-4 w-4 mr-2"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                    </svg>
                    Send via WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Empty State */}
        {filteredDrivers.length === 0 && !isLoading && !error && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No drivers found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Get started by adding your first driver."}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
