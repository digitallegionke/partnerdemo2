"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  MapPin,
  Clock,
  Truck,
  MoreVertical,
  Download,
  Search,
  Map,
  Loader2,
  RefreshCw,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { RouteService, type RouteWithDriver } from "@/lib/services/routes";
import { DriverService } from "@/lib/services/drivers";
import { DeliveryService } from "@/lib/services/deliveries";
import { useToast } from "@/hooks/use-toast";
import AddressSearch from "@/components/address-search";
import { supabase } from "@/lib/supabase";
import { useRoute } from "@/hooks/use-route";

// Transform Supabase route data to UI format
const transformRouteForUI = async (route: RouteWithDriver) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDistance = (distance: number) => {
    return `${distance.toFixed(1)} km`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  // Get delivery count for this route
  let deliveryCount = 0;
  try {
    const deliveries = await DeliveryService.getDeliveriesByRoute(route.id);
    deliveryCount = deliveries.length;
  } catch (error) {
    console.error("Error getting deliveries for route:", route.id, error);
    // Don't throw, just use 0 as default
  }

  return {
    id: route.id,
    name: route.name,
    distance: route.total_distance
      ? formatDistance(route.total_distance)
      : "0.0 km",
    duration: route.estimated_duration
      ? formatDuration(route.estimated_duration)
      : "0m",
    stops: deliveryCount,
    status: route.status,
    driver: route.driver?.name || "Unassigned",
    lastUpdated: getTimeAgo(route.updated_at),
    efficiency: route.efficiency_score || 0,
    // Keep raw data for other operations
    raw: route,
  };
};

interface RoutesScreenProps {
  onViewRouteMap: (route: any, deliveries: any[]) => void;
}

export default function RoutesScreen({ onViewRouteMap }: RoutesScreenProps) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    start_location: "",
    start_latitude: "",
    start_longitude: "",
    end_location: "",
    end_latitude: "",
    end_longitude: "",
    driver_id: "unassigned",
  });
  const [deliveries, setDeliveries] = useState([
    {
      id: Date.now(),
      customer_name: "",
      location: "",
      latitude: "",
      longitude: "",
      item: "",
      phone: "",
      delivery_notes: "",
      weight: "",
      estimated_value: "",
      drop_time: "",
    },
  ]);
  const [deliveryMode, setDeliveryMode] = useState<"new" | "existing">("new");
  const [existingDeliveries, setExistingDeliveries] = useState<any[]>([]);
  const [selectedExistingDeliveries, setSelectedExistingDeliveries] = useState<
    Set<number>
  >(new Set());
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routeDeliveries, setRouteDeliveries] = useState<any[]>([]);
  const [loadingRouteDeliveries, setLoadingRouteDeliveries] = useState(false);
  const { toast } = useToast();
  const { data, loading, error: routeError, fetchRoute } = useRoute();

  // Load routes from Supabase
  const loadRoutes = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all routes with driver information
      const routesData = await RouteService.getAllRoutes();

      if (routesData.length === 0) {
        setRoutes([]);
        return;
      }

      // Transform routes for UI display with better error handling
      const transformPromises = routesData.map(async (route) => {
        try {
          return await transformRouteForUI(route);
        } catch (error) {
          console.error(`Error transforming route ${route.id}:`, error);
          // Return basic route data if transformation fails
          return {
            id: route.id,
            name: route.name,
            distance: route.total_distance
              ? `${route.total_distance.toFixed(1)} km`
              : "0.0 km",
            duration: route.estimated_duration
              ? `${Math.floor(route.estimated_duration / 60)}h ${
                  route.estimated_duration % 60
                }m`
              : "0m",
            stops: 0,
            status: route.status,
            driver: route.driver?.name || "Unassigned",
            lastUpdated: new Date(route.updated_at).toLocaleDateString(),
            efficiency: route.efficiency_score || 0,
            raw: route,
          };
        }
      });

      const transformedRoutes = await Promise.all(transformPromises);
      setRoutes(transformedRoutes);
    } catch (err) {
      console.error("Error loading routes:", err);
      setError("Failed to load routes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load drivers from Supabase
  const loadDrivers = async () => {
    try {
      const driversData = await DriverService.getAllDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error("Error loading drivers:", error);
    }
  };

  // Load unassigned deliveries
  const loadUnassignedDeliveries = async () => {
    try {
      const allDeliveries = await DeliveryService.getAllDeliveries();
      // Filter deliveries that are not assigned to any route
      const unassigned = allDeliveries.filter(
        (delivery) => !delivery.route_id && delivery.status === "pending"
      );
      setExistingDeliveries(unassigned);
    } catch (error) {
      console.error("Error loading unassigned deliveries:", error);
    }
  };

  // Load deliveries for a specific route
  const loadRouteDeliveries = async (routeId: number) => {
    try {
      setLoadingRouteDeliveries(true);
      const deliveries = await DeliveryService.getDeliveriesByRoute(routeId);
      setRouteDeliveries(deliveries);
    } catch (error) {
      console.error("Error loading route deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to load route deliveries. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingRouteDeliveries(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadRoutes();
    loadDrivers();
    loadUnassignedDeliveries();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      start_location: "",
      start_latitude: "",
      start_longitude: "",
      end_location: "",
      end_latitude: "",
      end_longitude: "",
      driver_id: "unassigned",
    });
    setDeliveries([
      {
        id: Date.now(),
        customer_name: "",
        location: "",
        latitude: "",
        longitude: "",
        item: "",
        phone: "",
        delivery_notes: "",
      },
    ]);
    setDeliveryMode("new");
    setSelectedExistingDeliveries(new Set());
    setRouteDeliveries([]);
    setEditingRoute(null);
  };

  const addDelivery = () => {
    setDeliveries([
      ...deliveries,
      {
        id: Date.now(),
        customer_name: "",
        location: "",
        latitude: "",
        longitude: "",
        item: "",
        phone: "",
        delivery_notes: "",
      },
    ]);
  };

  const removeDelivery = (id: number) => {
    if (deliveries.length > 1) {
      setDeliveries(deliveries.filter((delivery) => delivery.id !== id));
    }
  };

  const updateDelivery = (id: string, field: string, value: string) => {
    console.log("delivery id updating", id, field, value);
    setDeliveries(
      deliveries.map((delivery) =>
        delivery.id === id ? { ...delivery, [field]: value } : delivery
      )
    );
  };

  const toggleExistingDelivery = (deliveryId: number) => {
    const newSelection = new Set(selectedExistingDeliveries);
    if (newSelection.has(deliveryId)) {
      newSelection.delete(deliveryId);
    } else {
      newSelection.add(deliveryId);
    }
    setSelectedExistingDeliveries(newSelection);
  };

  const handleAddDialogChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (open) {
      // Refresh unassigned deliveries when dialog opens
      loadUnassignedDeliveries();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate that locations have been selected with coordinates
      if (!formData.start_latitude || !formData.start_longitude) {
        toast({
          title: "Error",
          description: "Please select a valid start location with coordinates.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (!formData.end_latitude || !formData.end_longitude) {
        toast({
          title: "Error",
          description: "Please select a valid end location with coordinates.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validate deliveries based on mode
      let deliveryCount = 0;
      if (deliveryMode === "new") {
        const validDeliveries = deliveries.filter(
          (delivery) =>
            delivery.customer_name.trim() &&
            delivery.location.trim() &&
            delivery.latitude &&
            delivery.longitude &&
            delivery.phone.trim()
        );
        console.log(
          "Valid deliveries:",
          validDeliveries,
          "deliveries",
          deliveries
        );
        deliveryCount = validDeliveries.length;
      } else {
        deliveryCount = selectedExistingDeliveries.size;
      }

      if (deliveryCount === 0) {
        toast({
          title: "Error",
          description:
            deliveryMode === "new"
              ? "Please add at least one delivery with customer name and location."
              : "Please select at least one existing delivery.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Create the route first
      const routeData = {
        name: formData.name,
        start_location: formData.start_location,
        end_location: formData.end_location,
        driver_id:
          formData.driver_id !== "unassigned"
            ? parseInt(formData.driver_id)
            : null,
        status: "pending" as const,
      };

      const createdRoute = await RouteService.createRoute(routeData);

      if (deliveryMode === "new") {
        // Create new deliveries for this route
        for (let i = 0; i < deliveries.length; i++) {
          const delivery = deliveries[i];
          const latitude = parseFloat(delivery.latitude);
          const longitude = parseFloat(delivery.longitude);
          const deliveryData = {
            customer_name: delivery.customer_name,
            location: delivery.location,
            coordinates: [longitude, latitude] as [number, number],
            item: delivery.item,
            phone: delivery.phone,
            drop_time: delivery.drop_time ,
            estimated_value: delivery.estimated_value || null,
            weight: delivery.weight || null,
            status: "pending",
            delivery_notes: delivery.delivery_notes,
          };

          try {
            const createdDelivery = await DeliveryService.createDelivery(
              deliveryData
            );
            

            if (createdRoute?.id && createdDelivery?.id) {
              await supabase
                .from("deliveries")
                .update({ route_id: createdRoute.id })
                .eq("id", createdDelivery.id);
            }

            return createdDelivery;
          } catch (err) {
            console.error("Failed to create delivery:", err, deliveryData);
          }
        }
      } else {
        // Assign existing deliveries to this route
        const selectedIds = Array.from(selectedExistingDeliveries);
        const updatePromises = selectedIds.map(async (deliveryId, index) => {
          return await supabase
            .from("deliveries")
            .update({ route_id: createdRoute.id, order_index: index })
            .eq("id", deliveryId);
        });

        await Promise.all(updatePromises);

        // Refresh the unassigned deliveries list
        await loadUnassignedDeliveries();
      }

      // Reset form and close dialog
      resetForm();
      setIsAddDialogOpen(false);

      // Refresh routes list
      await loadRoutes();

      toast({
        title: "Success",
        description: `Route created successfully with ${deliveryCount} deliveries!`,
      });
    } catch (error) {
      console.error("Error creating route:", error);
      toast({
        title: "Error",
        description: "Failed to create route. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch = route.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterStatus === "all" || route.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200";
      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "pending":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  const handleViewMap = async (route: any) => {
    try {
      // Use the raw route data if available, otherwise find by ID
      const routeData = route.raw || route;

      const deliveries = await DeliveryService.getDeliveriesByRoute(
        routeData.id
      );
      onViewRouteMap(routeData, deliveries);
    } catch (error) {
      console.error("Error loading route deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to load route deliveries. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditRoute = async (route: any) => {
    const routeData = route.raw || route;
    setEditingRoute(routeData);

    // Pre-populate form with route data
    setFormData({
      name: routeData.name || "",
      start_location: routeData.start_location || "",
      start_latitude: "",
      start_longitude: "",
      end_location: routeData.end_location || "",
      end_latitude: "",
      end_longitude: "",
      driver_id: routeData.driver_id
        ? routeData.driver_id.toString()
        : "unassigned",
    });

    // Load deliveries for this route
    await loadRouteDeliveries(routeData.id);

    setIsEditDialogOpen(true);
  };

  // Remove delivery from route
  const handleRemoveDeliveryFromRoute = async (deliveryId: number) => {
    try {
      await DeliveryService.updateDelivery(deliveryId, {
        route_id: null,
        status: "pending",
      });

      // Refresh route deliveries
      if (editingRoute) {
        await loadRouteDeliveries(editingRoute.id);
      }

      // Refresh unassigned deliveries
      await loadUnassignedDeliveries();

      toast({
        title: "Success",
        description: "Delivery removed from route successfully!",
      });
    } catch (error) {
      console.error("Error removing delivery from route:", error);
      toast({
        title: "Error",
        description: "Failed to remove delivery from route. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add delivery to current route
  const handleAddDeliveryToRoute = async (deliveryId: number) => {
    if (!editingRoute) return;

    try {
      await RouteService.addDeliveryToRoute(deliveryId, editingRoute.id);

      // Refresh route deliveries
      await loadRouteDeliveries(editingRoute.id);

      // Refresh unassigned deliveries
      await loadUnassignedDeliveries();

      toast({
        title: "Success",
        description: "Delivery added to route successfully!",
      });
    } catch (error) {
      console.error("Error adding delivery to route:", error);
      toast({
        title: "Error",
        description: "Failed to add delivery to route. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;

    setIsSubmitting(true);

    try {
      const updateData: any = {
        name: formData.name,
        start_location: formData.start_location,
        end_location: formData.end_location,
        driver_id:
          formData.driver_id !== "unassigned"
            ? parseInt(formData.driver_id)
            : null,
      };

      await RouteService.updateRoute(editingRoute.id, updateData);

      // Reset form and close dialog
      resetForm();
      setIsEditDialogOpen(false);
      setEditingRoute(null);
      setRouteDeliveries([]);

      // Refresh routes list
      await loadRoutes();

      toast({
        title: "Success",
        description: "Route updated successfully!",
      });
    } catch (error) {
      console.error("Error updating route:", error);
      toast({
        title: "Error",
        description: "Failed to update route. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                Routes
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Manage and optimize your delivery routes
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-gray-600 text-xs sm:text-sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadRoutes}
                className="text-gray-600 text-xs sm:text-sm"
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Dialog
                open={isAddDialogOpen}
                onOpenChange={handleAddDialogChange}
              >
                <DialogTrigger asChild>
                  <Button
                    size="default"
                    className="text-sm sm:text-sm px-4 py-2 h-10 sm:h-9"
                  >
                    <Plus className="h-4 w-4 sm:h-4 sm:w-4 mr-2 sm:mr-2" />
                    <span className="hidden sm:inline">Add Route</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Route</DialogTitle>
                    <DialogDescription>
                      Create a new route with multiple delivery stops.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Route Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="routeName">Route Name *</Label>
                        <Input
                          id="routeName"
                          placeholder="Enter route name"
                          value={formData.name}
                          onChange={(e) =>
                            handleInputChange("name", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="driver">Assign Driver (Optional)</Label>
                        <Select
                          value={formData.driver_id}
                          onValueChange={(value) =>
                            handleInputChange("driver_id", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a driver" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              Unassigned
                            </SelectItem>
                            {drivers.map((driver) => (
                              <SelectItem
                                key={driver.id}
                                value={driver.id.toString()}
                              >
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Start and End Locations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startLocation">Start Location *</Label>
                        <AddressSearch
                          value={formData.start_location}
                          onSelect={(result) => {
                            handleInputChange(
                              "start_location",
                              result.display_name
                            );
                            if (result?.coordinates) {
                              handleInputChange(
                                "start_latitude",
                                result.coordinates[0].toString()
                              );
                              handleInputChange(
                                "start_longitude",
                                result.coordinates[1].toString()
                              );
                            } else {
                              handleInputChange("start_latitude", "");
                              handleInputChange("start_longitude", "");
                            }
                          }}
                          placeholder="Search for starting point"
                          className="mt-1"
                          countryCode="ke"
                        />
                        {formData.start_latitude &&
                          formData.start_longitude && (
                            <p className="text-xs text-gray-500 mt-1">
                              Coordinates:{" "}
                              {parseFloat(formData.start_latitude).toFixed(4)},{" "}
                              {parseFloat(formData.start_longitude).toFixed(4)}
                            </p>
                          )}
                      </div>
                      <div>
                        <Label htmlFor="endLocation">End Location *</Label>
                        <AddressSearch
                          value={formData.end_location}
                          onSelect={(result) => {
                            handleInputChange(
                              "end_location",
                              result.display_name
                            );
                            if (result?.coordinates) {
                              handleInputChange(
                                "end_latitude",
                                result.coordinates[0].toString()
                              );
                              handleInputChange(
                                "end_longitude",
                                result.coordinates[1].toString()
                              );
                            } else {
                              handleInputChange("end_latitude", "");
                              handleInputChange("end_longitude", "");
                            }
                          }}
                          placeholder="Search for ending point"
                          className="mt-1"
                          countryCode="ke"
                        />
                        {formData.end_latitude && formData.end_longitude && (
                          <p className="text-xs text-gray-500 mt-1">
                            Coordinates:{" "}
                            {parseFloat(formData.end_latitude).toFixed(4)},{" "}
                            {parseFloat(formData.end_longitude).toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Deliveries Section */}
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <Label className="text-base font-medium">
                            Delivery Stops
                          </Label>
                          <p className="text-sm text-gray-600">
                            Add delivery locations for this route
                          </p>
                        </div>
                      </div>

                      {/* Delivery Mode Toggle */}
                      <div className="flex gap-2 mb-4">
                        <Button
                          type="button"
                          variant={
                            deliveryMode === "new" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setDeliveryMode("new")}
                        >
                          Create New Deliveries
                        </Button>
                        <Button
                          type="button"
                          variant={
                            deliveryMode === "existing" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setDeliveryMode("existing")}
                        >
                          Select Existing Deliveries (
                          {existingDeliveries.length} available)
                        </Button>
                      </div>

                      {deliveryMode === "new" ? (
                        // New Deliveries Interface
                        <>
                          <div className="flex justify-end mb-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addDelivery}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Delivery
                            </Button>
                          </div>

                          <div className="space-y-4 max-h-60 overflow-y-auto">
                            {deliveries.map((delivery, index) => (
                              <div
                                key={delivery.id}
                                className="p-4 border rounded-lg bg-gray-50"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-gray-900">
                                    Delivery #{index + 1}
                                  </h4>
                                  {deliveries.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        removeDelivery(delivery.id)
                                      }
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <Label>Customer Name *</Label>
                                    <Input
                                      placeholder="Customer name"
                                      value={delivery.customer_name}
                                      required
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "customer_name",
                                          e.target.value
                                        )
                                      }
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label>Phone Number *</Label>
                                    <Input
                                      placeholder="+254 712 345 678"
                                      value={delivery.phone}
                                      required
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "phone",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label>Delivery Location *</Label>
                                    <AddressSearch
                                      value={delivery.location}
                                      onSelect={(result) => {
                                        setDeliveries((prev) =>
                                          prev.map((d) =>
                                            d.id === delivery.id
                                              ? {
                                                  ...d,
                                                  location: result.display_name,
                                                  latitude:
                                                    result.coordinates[0].toString(),
                                                  longitude:
                                                    result.coordinates[1].toString(),
                                                }
                                              : d
                                          )
                                        );
                                      }}
                                      placeholder="Search for delivery location"
                                      className="mt-1"
                                      countryCode="ke"
                                    />
                                    {delivery.latitude &&
                                      delivery.longitude && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Coordinates:{" "}
                                          {parseFloat(
                                            delivery.latitude
                                          ).toFixed(4)}
                                          ,{" "}
                                          {parseFloat(
                                            delivery.longitude
                                          ).toFixed(4)}
                                        </p>
                                      )}
                                  </div>
                                  <div>
                                    <Label>Item *</Label>
                                    <Input
                                      placeholder="What to deliver"
                                      required
                                      value={delivery.item}
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "item",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Drop Time *</Label>
                                    <Input
                                      type="time"
                                      value={delivery.drop_time}
                                      required
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "drop_time",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Estimated value</Label>
                                    <Input
                                      placeholder="KSh 2,500"
                                      value={delivery.estimated_value}
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "estimated_value",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Weight</Label>
                                    <Input
                                      placeholder="5 Kgs"
                                      value={delivery.weight}
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "weight",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Notes</Label>
                                    <Input
                                      placeholder="Special instructions"
                                      value={delivery.delivery_notes}
                                      onChange={(e) =>
                                        updateDelivery(
                                          delivery.id,
                                          "delivery_notes",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        // Existing Deliveries Interface
                        <div className="max-h-60 overflow-y-auto">
                          {existingDeliveries.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p>No unassigned deliveries available.</p>
                              <p className="text-sm mt-1">
                                Create new deliveries or check the Deliveries
                                page.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {existingDeliveries.map((delivery) => (
                                <div
                                  key={delivery.id}
                                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                    selectedExistingDeliveries.has(delivery.id)
                                      ? "bg-blue-50 border-blue-200"
                                      : "bg-gray-50 hover:bg-gray-100"
                                  }`}
                                  onClick={() =>
                                    toggleExistingDelivery(delivery.id)
                                  }
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={selectedExistingDeliveries.has(
                                            delivery.id
                                          )}
                                          onChange={() =>
                                            toggleExistingDelivery(delivery.id)
                                          }
                                          className="rounded border-gray-300"
                                        />
                                        <div>
                                          <h4 className="font-medium text-gray-900">
                                            {delivery.customer_name}
                                          </h4>
                                          <p className="text-sm text-gray-600">
                                            {delivery.location}
                                          </p>
                                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                            {delivery.item && (
                                              <span>📦 {delivery.item}</span>
                                            )}
                                            {delivery.phone && (
                                              <span>📞 {delivery.phone}</span>
                                            )}
                                            <span
                                              className={`px-2 py-1 rounded-full ${
                                                delivery.status === "pending"
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-gray-100 text-gray-800"
                                              }`}
                                            >
                                              {delivery.status}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3">
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
                        {isSubmitting ? "Creating..." : "Create Route"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit Route Dialog */}
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Route - {editingRoute?.name}</DialogTitle>
                    <DialogDescription>
                      Update route information, manage deliveries, and assign
                      drivers.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Route Information Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Route Information</h3>
                      <form onSubmit={handleUpdateRoute} className="space-y-4">
                        <div>
                          <Label htmlFor="editRouteName">Route Name *</Label>
                          <Input
                            id="editRouteName"
                            placeholder="Enter route name"
                            value={formData.name}
                            onChange={(e) =>
                              handleInputChange("name", e.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="editStartLocation">
                            Start Location
                          </Label>
                          <AddressSearch
                            value={formData.start_location}
                            onSelect={(result) => {
                              handleInputChange(
                                "start_location",
                                result.display_name
                              );
                              handleInputChange(
                                "start_latitude",
                                result.coordinates[0].toString()
                              );
                              handleInputChange(
                                "start_longitude",
                                result.coordinates[1].toString()
                              );
                            }}
                            placeholder="Search for starting point"
                            className="mt-1"
                            countryCode="ke"
                          />
                          {formData.start_latitude &&
                            formData.start_longitude && (
                              <p className="text-xs text-gray-500 mt-1">
                                Coordinates:{" "}
                                {parseFloat(formData.start_latitude).toFixed(4)}
                                ,{" "}
                                {parseFloat(formData.start_longitude).toFixed(
                                  4
                                )}
                              </p>
                            )}
                        </div>
                        <div>
                          <Label htmlFor="editEndLocation">End Location</Label>
                          <AddressSearch
                            value={formData.end_location}
                            onSelect={(result) => {
                              handleInputChange(
                                "end_location",
                                result.display_name
                              );
                              handleInputChange(
                                "end_latitude",
                                result.coordinates[0].toString()
                              );
                              handleInputChange(
                                "end_longitude",
                                result.coordinates[1].toString()
                              );
                            }}
                            placeholder="Search for ending point"
                            className="mt-1"
                            countryCode="ke"
                          />
                          {formData.end_latitude && formData.end_longitude && (
                            <p className="text-xs text-gray-500 mt-1">
                              Coordinates:{" "}
                              {parseFloat(formData.end_latitude).toFixed(4)},{" "}
                              {parseFloat(formData.end_longitude).toFixed(4)}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="editDriver">Assign Driver</Label>
                          <Select
                            value={formData.driver_id}
                            onValueChange={(value) =>
                              handleInputChange("driver_id", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a driver" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                Unassigned
                              </SelectItem>
                              {drivers.map((driver) => (
                                <SelectItem
                                  key={driver.id}
                                  value={driver.id.toString()}
                                >
                                  {driver.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              resetForm();
                              setIsEditDialogOpen(false);
                              setEditingRoute(null);
                              setRouteDeliveries([]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Update Route"}
                          </Button>
                        </div>
                      </form>
                    </div>

                    {/* Route Deliveries Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">
                          Route Deliveries
                        </h3>
                        {loadingRouteDeliveries && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>

                      {/* Current Route Deliveries */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">
                          Current Deliveries ({routeDeliveries.length})
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {routeDeliveries.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">
                              No deliveries assigned to this route
                            </p>
                          ) : (
                            routeDeliveries.map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {delivery.customer_name}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {delivery.location}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {delivery.item} • {delivery.phone}
                                  </p>
                                  <Badge
                                    variant={
                                      delivery.status === "completed"
                                        ? "default"
                                        : delivery.status === "in-progress"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {delivery.status}
                                  </Badge>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleRemoveDeliveryFromRoute(delivery.id)
                                  }
                                  className="ml-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Available Deliveries to Add */}
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">
                          Available Deliveries ({existingDeliveries.length})
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {existingDeliveries.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">
                              No unassigned deliveries available
                            </p>
                          ) : (
                            existingDeliveries.map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {delivery.customer_name}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {delivery.location}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {delivery.item} • {delivery.phone}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {delivery.status}
                                  </Badge>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleAddDeliveryToRoute(delivery.id)
                                  }
                                  className="ml-2"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search routes..."
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading routes...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error loading routes
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadRoutes}>Try Again</Button>
          </div>
        )}

        {/* Routes Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredRoutes.map((route) => (
              <Card
                key={route.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-gray-900">
                      {route.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`${getStatusColor(route.status)} text-xs`}
                        variant="outline"
                      >
                        {route.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-900">{route.distance}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-900">{route.duration}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-gray-900">
                          {route.stops} stop{route.stops !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {route.efficiency > 0 && (
                        <span className="text-green-600 font-medium">
                          {route.efficiency}% efficient
                        </span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Driver:</span>
                        <span className="text-gray-900 font-medium">
                          {route.driver}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-500">Updated:</span>
                        <span className="text-gray-600">
                          {route.lastUpdated}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleEditRoute(route)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleViewMap(route)}
                      >
                        <Map className="h-4 w-4 mr-2" />
                        Map
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredRoutes.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No routes found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Get started by creating your first route."}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Route
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
