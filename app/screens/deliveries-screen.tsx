"use client";

import { useState, useEffect } from "react";
import {
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  Filter,
  Download,
  Search,
  Eye,
  Edit,
  MoreVertical,
  Truck,
  CheckCircle,
  AlertCircle,
  XCircle,
  Plus,
  RefreshCw,
  Activity,
  DollarSign,
  ChevronRight,
  Star,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DeliveryService } from "@/lib/services/deliveries";
import AddressSearch from "@/components/address-search";
import { toast } from "@/hooks/use-toast";
import { DriverService } from "@/lib/services/drivers";
import { RouteService } from "@/lib/services/routes";

interface RouteOption {
  id: number;
  name: string;
  status: string;
  driverName?: string;
}
// Transform Supabase delivery data to UI format

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [editingDelivery, setEditingDelivery] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importProgress, setImportProgress] = useState({
    total: 0,
    completed: 0,
    skipped: 0,
    isProcessing: false,
  });
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    inTransit: 0,
    pending: 0,
    failed: 0,
    totalValue: 0,
    avgDeliveryTime: "2.5 hrs",
  });
  const [formData, setFormData] = useState({
    customer_name: "",
    location: "",
    latitude: "",
    longitude: "",
    item: "",
    estimated_value: "",
    weight: "",
    phone: "",
    drop_time: "",
  });

  // useEffect(() => {
  //   const fetchRoutes = async () => {
  //     try {
  //       setLoading(true);
  //       const routesData = await RouteService.getAllRoutes();
  //       const routeOptions = routesData.map((route) => ({
  //         id: route.id,
  //         name: route.name,
  //         status: route.status,
  //         driverName: route.driver?.name,
  //       }));

  //       setRoutes(routeOptions);
  //     } catch (error) {
  //       console.error("Error fetching routes:", error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchRoutes();
  // }, []);

  const transformDeliveryForUI = (delivery: any) => {
    const getInitials = (name: string) => {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    };

    const formatTime = (timeString: string) => {
      const [hours, minutes] = timeString.split(":");
      const hour24 = parseInt(hours);
      const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24;
      const ampm = hour24 >= 12 ? "PM" : "AM";
      return `${hour12}:${minutes} ${ampm}`;
    };

    const formatDate = (dateString: string) => {
      return dateString.split("T")[0];
    };

    const mapStatus = (status: string) => {
      switch (status) {
        case "completed":
          return "delivered";
        case "in-progress":
          return "in-transit";
        default:
          return status;
      }
    };

    return {
      id: `DEL-${(delivery.id || 0).toString().padStart(3, "0")}`,
      recipient: delivery.customer_name.trim(),
      address: delivery.location || "Address not provided",
      phone: delivery.phone || "Not provided",
      status: mapStatus(delivery.status || "pending"),
      driver: delivery?.driver ? delivery?.driver.name : "Unassigned",
      driverAvatar: delivery?.driver
        ? getInitials(delivery?.driver.name)
        : getInitials("Unassigned"),
      scheduledTime: delivery.drop_time
        ? formatTime(delivery.drop_time)
        : "Not scheduled",
      deliveredTime:
        delivery.status === "completed" && delivery.drop_time
          ? formatTime(delivery.drop_time)
          : null,
      items: [
        (delivery.item || "No item specified") +
          (delivery.weight ? ` (${delivery.weight})` : ""),
      ],
      value: delivery.estimated_value || "Not specified",
      priority: "medium", // TODO: Add priority logic
      date: delivery.created_at
        ? formatDate(delivery.created_at)
        : "Unknown date",
    };
  };

  // Load deliveries from Supabase
  const loadDeliveries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DeliveryService.getAllDeliveries();
      const transformedDeliveries = data.map(transformDeliveryForUI);
      setDeliveries(transformedDeliveries);

      // Calculate enhanced stats
      const totalValue = transformedDeliveries.reduce((sum, d) => {
        const value = d.value?.replace(/[^\d]/g, "") || "0";
        return sum + parseInt(value);
      }, 0);

      const newStats = {
        total: transformedDeliveries.length,
        delivered: transformedDeliveries.filter((d) => d.status === "delivered")
          .length,
        inTransit: transformedDeliveries.filter(
          (d) => d.status === "in-transit"
        ).length,
        pending: transformedDeliveries.filter((d) => d.status === "pending")
          .length,
        failed: transformedDeliveries.filter((d) => d.status === "failed")
          .length,
        totalValue: totalValue,
        avgDeliveryTime: "2.5 hrs",
      };
      setStats(newStats);
    } catch (err) {
      console.error("Error loading deliveries:", err);
      setError("Failed to load deliveries. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load deliveries on component mount
  useEffect(() => {
    loadDeliveries();
  }, []);

  useEffect(() => {
    if (!isAddDialogOpen) {
      resetForm();
    }
  }, [isAddDialogOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      location: "",
      latitude: "",
      longitude: "",
      item: "",
      estimated_value: "",
      weight: "",
      phone: "",
      drop_time: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate coordinates
      const latitude = parseFloat(formData.latitude);
      const longitude = parseFloat(formData.longitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        alert("Please select a valid delivery location with coordinates.");
        setIsSubmitting(false);
        return;
      }

      const deliveryData = {
        customer_name: formData.customer_name,
        location: formData.location,
        coordinates: [longitude, latitude] as [number, number], // [lat, lng] format for frontend
        item: formData.item,
        estimated_value: formData.estimated_value || null,
        weight: formData.weight || null,
        phone: formData.phone,
        drop_time: formData.drop_time,
        status: "pending" as const,
      } as const;

      await DeliveryService.createDelivery(deliveryData);

      // Reset form and close dialog
      resetForm();
      setIsAddDialogOpen(false);

      // Refresh deliveries list
      await loadDeliveries();
    } catch (error) {
      console.error("Error creating delivery:", error);
      alert("Failed to create delivery. Please check the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDelivery = (delivery: any) => {
    setSelectedDelivery(delivery);
    setIsViewDialogOpen(true);
  };

  const handleEditDelivery = (delivery: any) => {
    setEditingDelivery(delivery);

    // Pre-populate form with delivery data
    setFormData({
      customer_name: delivery.recipient || "",
      location: delivery.address || "",
      latitude: "",
      longitude: "",
      item: delivery.items?.[0]?.split(" (")[0] || "",
      estimated_value: delivery.value !== "Not specified" ? delivery.value : "",
      weight: delivery.items?.[0]?.includes("(")
        ? delivery.items[0].split("(")[1]?.replace(")", "")
        : "",
      phone: delivery.phone !== "Not provided" ? delivery.phone : "",
      drop_time: delivery.scheduledTime
        ? convertTo24Hour(delivery.scheduledTime)
        : "",
    });

    setIsEditDialogOpen(true);
  };

  // Helper function to convert 12-hour format to 24-hour format
  const convertTo24Hour = (time12h: string) => {
    if (!time12h || time12h === "Not scheduled") return "";

    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":");

    if (hours === "12") {
      hours = "00";
    }

    if (modifier === "PM") {
      hours = (parseInt(hours, 10) + 12).toString();
    }

    return `${hours.padStart(2, "0")}:${minutes}`;
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

      const requiredHeaders = [
        "customer_name",
        "location",
        "lat",
        "lng",
        "item",
        "phone",
        "drop_time",
      ];
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

      const newDeliveries = [];
      const totalRows = lines.length - 1;
      setImportProgress((prev) => ({ ...prev, total: totalRows }));
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        const lat = Number.parseFloat(values[headers.indexOf("lat")]);
        const lng = Number.parseFloat(values[headers.indexOf("lng")]);

        if (isNaN(lat) || isNaN(lng)) {
          console.warn(`Invalid coordinates at row ${i + 1}`);
          continue;
        }

        const delivery = {
          customer_name: values[headers.indexOf("customer_name")] || "",
          location: values[headers.indexOf("location")] || "",
          coordinates: [lng, lat] as [number, number],
          item: values[headers.indexOf("item")],
          estimated_value: values[headers.indexOf("estimated_value")] || null,
          weight: values[headers.indexOf("weight")] || null,
          phone: values[headers.indexOf("phone")],
          drop_time: values[headers.indexOf("drop_time")],
          status: "pending",
        };

        newDeliveries.push({
          ...delivery,
        });
        setImportProgress((prev) => ({
          ...prev,
          completed: prev.completed + 1,
        }));
        await DeliveryService.createDelivery(delivery);
      }

      toast({
        title: "Import successful",
        description: `Successfully imported ${
          newDeliveries.length
        } deliveries.${
          importProgress.skipped > 0
            ? ` ${importProgress.skipped} rows were skipped.`
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
      await loadDeliveries();
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

  const handleUpdateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;

    setIsSubmitting(true);

    try {
      const latitude = parseFloat(formData.latitude);
      const longitude = parseFloat(formData.longitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        alert("Please select a valid delivery location with coordinates.");
        setIsSubmitting(false);
        return;
      }

      const deliveryData = {
        customer_name: formData.customer_name,
        location: formData.location,
        coordinates: `(${latitude},${longitude} )`,
        item: formData.item,
        estimated_value: formData.estimated_value,
        weight: formData.weight,
        phone: formData.phone,
        drop_time: formData.drop_time
          ? convertTo24Hour(formData.drop_time)
          : "",
      };
      const deliveryId = parseInt(editingDelivery.id.replace(/\D/g, ""), 10);

      await DeliveryService.updateDelivery(deliveryId, deliveryData);
      // Reset form and close dialog
      resetForm();
      setIsEditDialogOpen(false);
      setEditingDelivery(null);

      // Refresh deliveries list
      await loadDeliveries();

      toast({ title: "Delivery updated successfully!" });
    } catch (error) {
      console.error("Error updating delivery:", error);
      toast({ title: "Failed to update delivery. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      (delivery.recipient?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (delivery.address?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (delivery.id?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || delivery.status === filterStatus;
    const matchesDate = filterDate === "all" || delivery.date === filterDate;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in-transit":
        return <Activity className="h-4 w-4 text-blue-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-50 text-green-700 border-green-200";
      case "in-transit":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "pending":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "failed":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 text-red-700 border-red-200";
      case "medium":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "low":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const getCompletionRate = () => {
    return stats.total > 0
      ? Math.round((stats.delivered / stats.total) * 100)
      : 0;
  };

  const DeliveryCard = ({ delivery }: { delivery: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(delivery.status)}
            <div>
              <h3 className="font-medium text-gray-900">
                {delivery.recipient}
              </h3>
              <p className="text-sm text-gray-500">{delivery.id}</p>
            </div>
          </div>
          <Badge
            className={`${getStatusColor(delivery.status)} text-xs`}
            variant="outline"
          >
            {delivery.status}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-600 line-clamp-2">
              {delivery.address}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{delivery.items[0]}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {delivery.scheduledTime}
              </span>
            </div>
            {delivery.value !== "Not specified" && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {delivery.value}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                {delivery.driverAvatar}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">{delivery.driver}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewDelivery(delivery)}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditDelivery(delivery)}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
              <p className="text-gray-600 mt-1">
                Track and manage all your deliveries
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="text-gray-600">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-gray-600"
                onClick={loadDeliveries}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Delivery
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Delivery</DialogTitle>
                    <DialogDescription>
                      Add a new delivery to the system.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customer_name">Customer Name *</Label>
                        <Input
                          id="customer_name"
                          type="text"
                          required
                          value={formData.customer_name}
                          onChange={(e) =>
                            handleInputChange("customer_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) =>
                            handleInputChange("phone", e.target.value)
                          }
                          placeholder="+254 712 345 678"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="location">Delivery Location *</Label>
                      <AddressSearch
                        value={formData.location}
                        onSelect={(result) => {
                          handleInputChange("location", result.display_name);
                          if (result?.coordinates) {
                            handleInputChange(
                              "latitude",
                              result.coordinates[0].toString()
                            );
                            handleInputChange(
                              "longitude",
                              result.coordinates[1].toString()
                            );
                          } else {
                            handleInputChange("latitude", "");
                            handleInputChange("longitude", "");
                          }
                        }}
                        placeholder="Enter delivery address"
                        className="mt-1"
                        countryCode="ke"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Latitude *</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          required
                          value={formData.latitude}
                          onChange={(e) =>
                            handleInputChange("latitude", e.target.value)
                          }
                          placeholder="-1.2921"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-filled when selecting address
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="longitude">Longitude *</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          required
                          value={formData.longitude}
                          onChange={(e) =>
                            handleInputChange("longitude", e.target.value)
                          }
                          placeholder="36.8219"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-filled when selecting address
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="item">Item *</Label>
                        <Input
                          id="item"
                          type="text"
                          required
                          value={formData.item}
                          onChange={(e) =>
                            handleInputChange("item", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="drop_time">Drop Time *</Label>
                        <Input
                          id="drop_time"
                          type="time"
                          required
                          value={formData.drop_time}
                          onChange={(e) =>
                            handleInputChange("drop_time", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="estimated_value">Estimated Value</Label>
                        <Input
                          id="estimated_value"
                          type="text"
                          value={formData.estimated_value}
                          onChange={(e) =>
                            handleInputChange("estimated_value", e.target.value)
                          }
                          placeholder="KSh 2,500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="weight">Weight</Label>
                        <Input
                          id="weight"
                          type="text"
                          value={formData.weight}
                          onChange={(e) =>
                            handleInputChange("weight", e.target.value)
                          }
                          placeholder="5kg"
                        />
                      </div>
                    </div>
                    {/* <div>
                      <Label htmlFor="route">Assign to Route</Label>
                      <Select
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, routeId: value }))
                        }
                        value={formData.routeId || ""}
                        disabled={loading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a route" />
                        </SelectTrigger>
                        <SelectContent>
                          {loading ? (
                            <SelectItem value="loading" disabled>
                              Loading routes...
                            </SelectItem>
                          ) : routes.length === 0 ? (
                            <SelectItem value="no-routes" disabled>
                              No routes available
                            </SelectItem>
                          ) : (
                            routes.map((route) => (
                              <SelectItem
                                key={route.id}
                                value={route.id.toString()}
                              >
                                {route.name} ({route.status}){" "}
                                {route.driverName && `- ${route.driverName}`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div> */}

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
                        {isSubmitting ? "Creating..." : "Create Delivery"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2" variant="outline">
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Deliveries from CSV</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {importProgress.isProcessing ? (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-lg font-medium">
                            Processing deliveries...
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {importProgress.completed} of {importProgress.total}{" "}
                            completed
                            {importProgress.skipped > 0 &&
                              ` • ${importProgress.skipped} skipped`}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                importProgress.total > 0
                                  ? (importProgress.completed /
                                      importProgress.total) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        {importProgress.completed === importProgress.total && (
                          <div className="text-center text-green-600 font-medium">
                            ✓ Import completed successfully!
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="csv-file">CSV File</Label>
                          <Input
                            id="csv-file"
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p className="font-medium mb-2">
                            Required CSV columns:
                          </p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>customer_name</li>
                            <li>location</li>
                            <li>lat (latitude)</li>
                            <li>lng (longitude)</li>
                            <li>item</li>
                            <li>phone</li>
                            <li>drop_time</li>
                          </ul>
                          <p className="mt-2">
                            Optional columns: estimated_value, weight
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              {/* View Delivery Dialog */}
              <Dialog
                open={isViewDialogOpen}
                onOpenChange={setIsViewDialogOpen}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      Delivery Details - {selectedDelivery?.id}
                    </DialogTitle>
                    <DialogDescription>
                      Complete information about this delivery
                    </DialogDescription>
                  </DialogHeader>
                  {selectedDelivery && (
                    <div className="space-y-6">
                      {/* Status and Priority */}
                      <div className="flex items-center gap-3">
                        <Badge
                          className={getStatusColor(selectedDelivery.status)}
                          variant="outline"
                        >
                          {selectedDelivery.status}
                        </Badge>
                        <Badge
                          className={getPriorityColor(
                            selectedDelivery.priority
                          )}
                          variant="outline"
                        >
                          {selectedDelivery.priority} priority
                        </Badge>
                      </div>

                      {/* Customer Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-medium text-gray-900 mb-3">
                            Customer Information
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center text-sm">
                              <User className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-900">
                                {selectedDelivery.recipient}
                              </span>
                            </div>
                            <div className="flex items-center text-sm">
                              <Phone className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-600">
                                {selectedDelivery.phone}
                              </span>
                            </div>
                            <div className="flex items-start text-sm">
                              <MapPin className="h-4 w-4 mr-2 text-gray-500 mt-0.5" />
                              <span className="text-gray-600">
                                {selectedDelivery.address}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-medium text-gray-900 mb-3">
                            Delivery Details
                          </h3>
                          <div className="space-y-2">
                            <div className="text-sm">
                              <span className="text-gray-500">Items:</span>
                              <div className="ml-4 mt-1">
                                {selectedDelivery.items?.map(
                                  (item: string, index: number) => (
                                    <p key={index} className="text-gray-900">
                                      {item}
                                    </p>
                                  )
                                )}
                              </div>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Value: </span>
                              <span className="text-gray-900">
                                {selectedDelivery.value}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Scheduled: </span>
                              <span className="text-gray-900">
                                {selectedDelivery.scheduledTime}
                              </span>
                            </div>
                            {selectedDelivery.deliveredTime && (
                              <div className="text-sm">
                                <span className="text-gray-500">
                                  Delivered:{" "}
                                </span>
                                <span className="text-green-600">
                                  {selectedDelivery.deliveredTime}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Driver Information */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">
                          Driver Assignment
                        </h3>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
                              {selectedDelivery.driverAvatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-gray-900">
                            {selectedDelivery.driver}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={() => setIsViewDialogOpen(false)}>
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Edit Delivery Dialog */}
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      Edit Delivery - {editingDelivery?.id}
                    </DialogTitle>
                    <DialogDescription>
                      Update delivery information.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateDelivery} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_customer_name">
                          Customer Name *
                        </Label>
                        <Input
                          id="edit_customer_name"
                          type="text"
                          required
                          value={formData.customer_name}
                          onChange={(e) =>
                            handleInputChange("customer_name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_phone">Phone Number *</Label>
                        <Input
                          id="edit_phone"
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) =>
                            handleInputChange("phone", e.target.value)
                          }
                          placeholder="+254 712 345 678"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit_location">Delivery Location *</Label>
                      <AddressSearch
                        value={formData.location}
                        onSelect={(result) => {
                          handleInputChange("location", result.display_name);
                          if (result?.coordinates) {
                            handleInputChange(
                              "latitude",
                              result.coordinates[0].toString()
                            );
                            handleInputChange(
                              "longitude",
                              result.coordinates[1].toString()
                            );
                          } else {
                            handleInputChange("latitude", "");
                            handleInputChange("longitude", "");
                          }
                        }}
                        placeholder="Enter delivery address"
                        className="mt-1"
                        countryCode="ke"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="latitude">Latitude *</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          required
                          value={formData.latitude}
                          onChange={(e) =>
                            handleInputChange("latitude", e.target.value)
                          }
                          placeholder="-1.2921"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-filled when selecting address
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="longitude">Longitude *</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          required
                          value={formData.longitude}
                          onChange={(e) =>
                            handleInputChange("longitude", e.target.value)
                          }
                          placeholder="36.8219"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-filled when selecting address
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_item">Item *</Label>
                        <Input
                          id="edit_item"
                          type="text"
                          required
                          value={formData.item}
                          onChange={(e) =>
                            handleInputChange("item", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_drop_time">Drop Time *</Label>
                        <Input
                          id="edit_drop_time"
                          type="time"
                          required
                          value={formData.drop_time}
                          onChange={(e) =>
                            handleInputChange("drop_time", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_estimated_value">
                          Estimated Value
                        </Label>
                        <Input
                          id="edit_estimated_value"
                          type="text"
                          value={formData.estimated_value}
                          onChange={(e) =>
                            handleInputChange("estimated_value", e.target.value)
                          }
                          placeholder="KSh 2,500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_weight">Weight</Label>
                        <Input
                          id="edit_weight"
                          type="text"
                          value={formData.weight}
                          onChange={(e) =>
                            handleInputChange("weight", e.target.value)
                          }
                          placeholder="5kg"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setIsEditDialogOpen(false);
                          setEditingDelivery(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Updating..." : "Update Delivery"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search deliveries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="in-transit">In Transit</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Deliveries</p>
                  <p className="text-3xl font-semibold text-gray-900">
                    {stats.total}
                  </p>
                  <div className="flex items-center mt-2">
                    <Progress
                      value={getCompletionRate()}
                      className="h-2 w-20 mr-2"
                    />
                    <span className="text-xs text-gray-500">
                      {getCompletionRate()}% completed
                    </span>
                  </div>
                </div>
                <Package className="h-12 w-12 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Delivered</p>
                  <p className="text-2xl font-semibold text-green-600">
                    {stats.delivered}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">In Transit</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    {stats.inTransit}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    KSh {stats.totalValue.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading deliveries...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error loading deliveries
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadDeliveries}>Try Again</Button>
          </div>
        )}

        {/* Deliveries Grid/List */}
        {!isLoading && !error && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-gray-900">
                    Deliveries ({filteredDeliveries.length})
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredDeliveries.length === 0
                      ? "No deliveries found"
                      : "Manage your delivery orders"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-gray-600">
                    {
                      filteredDeliveries.filter((d) => d.status === "delivered")
                        .length
                    }{" "}
                    completed
                  </Badge>
                  <Badge variant="outline" className="text-gray-600">
                    {
                      filteredDeliveries.filter(
                        (d) => d.status === "in-transit"
                      ).length
                    }{" "}
                    in progress
                  </Badge>
                </div>
              </div>
            </CardHeader>

            {/* Grid View */}
            {viewMode === "grid" && (
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDeliveries.map((delivery) => (
                    <DeliveryCard key={delivery.id} delivery={delivery} />
                  ))}
                </div>
              </CardContent>
            )}

            {/* List View */}
            {viewMode === "list" && (
              <div className="divide-y divide-gray-200">
                {filteredDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(delivery.status)}
                            <span className="font-medium text-gray-900">
                              {delivery.id}
                            </span>
                          </div>
                          <Badge
                            className={getStatusColor(delivery.status)}
                            variant="outline"
                          >
                            {delivery.status}
                          </Badge>
                          <Badge
                            className={getPriorityColor(delivery.priority)}
                            variant="outline"
                          >
                            {delivery.priority}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">
                              Recipient
                            </h4>
                            <div className="space-y-1">
                              <div className="flex items-center text-sm">
                                <User className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-900">
                                  {delivery.recipient}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-600">
                                  {delivery.address}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <Phone className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-600">
                                  {delivery.phone}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">
                              Items & Value
                            </h4>
                            <div className="space-y-1">
                              {delivery.items.map(
                                (item: string, index: number) => (
                                  <p
                                    key={index}
                                    className="text-sm text-gray-600"
                                  >
                                    {item}
                                  </p>
                                )
                              )}
                              {delivery.value !== "Not specified" && (
                                <p className="text-sm font-medium text-green-600 mt-2">
                                  {delivery.value}
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">
                              Driver & Timing
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                    {delivery.driverAvatar}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-gray-900">
                                  {delivery.driver}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <Clock className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-600">
                                  Scheduled: {delivery.scheduledTime}
                                </span>
                              </div>
                              {delivery.deliveredTime && (
                                <div className="flex items-center text-sm">
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                  <span className="text-green-600">
                                    Delivered: {delivery.deliveredTime}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDelivery(delivery)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDelivery(delivery)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredDeliveries.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No deliveries found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterStatus !== "all" || filterDate !== "all"
                    ? "Try adjusting your search criteria or filters."
                    : "Get started by creating your first delivery."}
                </p>
                {!searchTerm &&
                  filterStatus === "all" &&
                  filterDate === "all" && (
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Delivery
                    </Button>
                  )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
