"use client";

import { useState, useEffect } from "react";
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
    totalDeliveries: driver.deliveries[0]?.count || 0,
    completedToday:
      driver.status === "active" ? 1 : 0,
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
  const [callingDriver, setCallingDriver] = useState(null);
  const [driverId, setDriverId] = useState(0);
  const [phoneCopied, setPhoneCopied] = useState(false);

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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      vehicle_type: "",
      license_number: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

      await DriverService.createDriver(driverData);

      // Reset form and close dialog
      resetForm();
      setIsAddDialogOpen(false);

      // Refresh drivers list
      await loadDrivers();
    } catch (error) {
      console.error("Error creating driver:", error);
      // TODO: Show error toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (driver) => {
    setFormData({
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      vehicle_type: driver.vehicle.split(" - ")[0],
      license_number: driver.vehicle.split(" - ")[1],
    });
    setDriverId(driver.id);
    setIsEditModalOpen(true);
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
              <p className="text-gray-600 mt-1">
                Manage your delivery team and assignments
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDrivers}
                className="text-gray-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="text-gray-600">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Driver
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
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
                        required
                      />
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
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        placeholder="+254 7XX XXX XXX"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                      <Select
                        value={formData.vehicle_type}
                        onValueChange={(value) =>
                          handleInputChange("vehicle_type", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="Van">Van</SelectItem>
                          <SelectItem value="Truck">Truck</SelectItem>
                        </SelectContent>
                      </Select>
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
                        required
                      />
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
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
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
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.total}
                  </p>
                </div>
                <User className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-semibold text-green-600">
                    {stats.active}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">On Delivery</p>
                  <p className="text-2xl font-semibold text-orange-600">
                    {stats.busy}
                  </p>
                </div>
                <Truck className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.avgRating}
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-400" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
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
                      className="flex-1"
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
              <DialogTitle>Edit Driver</DialogTitle>
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
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="driver@roundi.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    placeholder="+254 7XX XXX XXX"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                  <Select
                    value={formData.vehicle_type}
                    onValueChange={(value) =>
                      handleInputChange("vehicle_type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="Van">Van</SelectItem>
                      <SelectItem value="Truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
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
                    required
                  />
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
                  <Button type="submit">Update Driver</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
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
