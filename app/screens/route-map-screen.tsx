"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  Users,
  Package,
  CheckCircle,
  AlertCircle,
  Settings,
  Zap,
  TrendingUp,
  Navigation,
  Phone,
  MapPin as MapPinIcon,
  Timer,
  DollarSign,
  Truck,
  Eye,
  ChevronRight,
  Activity,
  Signal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MapComponent from "@/app/components/map-component";
import {
  optimizeRoute,
  formatDistance,
  formatDuration,
  formatCost,
} from "@/lib/route-optimization";
import { toast } from "@/hooks/use-toast";

type DeliveryData = {
  id: number;
  customer_name: string;
  location: string;
  coordinates: [number, number]; // [lat, lng]
  item: string;
  estimated_value?: string | null;
  weight?: string | null;
  phone: string;
  drop_time: string;
  status: "pending" | "in-progress" | "completed" | "failed";
};

interface Route {
  id: number;
  name: string;
  distance: string;
  duration: string;
  stops: number;
  status: string;
  driver:
    | string
    | { id: number; name: string; phone: string; vehicle_type: string }
    | null;
  lastUpdated: string;
  efficiency: number;
}

interface RouteMapScreenProps {
  route: Route;
  deliveries: DeliveryData[];
  onBack: () => void;
}

export default function RouteMapScreen({
  route,
  deliveries,
  onBack,
}: RouteMapScreenProps) {
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryData | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isOptimizeDialogOpen, setIsOptimizeDialogOpen] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<
    "nearest-neighbor" | "genetic" | "2-opt" | "simulated-annealing"
  >("nearest-neighbor");
  const [optimizedDeliveries, setOptimizedDeliveries] =
    useState<DeliveryData[]>(deliveries);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLiveTrackingEnabled, setIsLiveTrackingEnabled] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callingCustomer, setCallingCustomer] = useState(null);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Helper function to get driver name safely
  const getDriverName = (driver: Route["driver"]): string => {
    if (!driver) return "Unassigned";
    if (typeof driver === "string") return driver;
    if (typeof driver === "object" && driver.name) return driver.name;
    return "Unassigned";
  };

  // Update optimized deliveries when deliveries prop changes
  useEffect(() => {
    setOptimizedDeliveries(deliveries);
    setOptimizationResult(null);
  }, [deliveries]);

  // Calculate stats
  const totalDeliveries = optimizedDeliveries.length;
  const completedDeliveries = optimizedDeliveries.filter(
    (d) => d.status === "completed"
  ).length;
  const inProgressDeliveries = optimizedDeliveries.filter(
    (d) => d.status === "in-progress"
  ).length;
  const pendingDeliveries = optimizedDeliveries.filter(
    (d) => d.status === "pending"
  ).length;
  const completionRate =
    totalDeliveries > 0
      ? Math.round((completedDeliveries / totalDeliveries) * 100)
      : 0;

  const handleOptimizeRoute = () => {
    setIsOptimizing(true);

    // Simulate optimization process with a delay
    setTimeout(() => {
      const result = optimizeRoute(deliveries, selectedAlgorithm);
      setOptimizationResult(result);
      setIsOptimizing(false);
    }, 2000);
  };

  const applyOptimization = () => {
    if (optimizationResult) {
      setOptimizedDeliveries(optimizationResult.optimizedOrder);
      setIsOptimizeDialogOpen(false);
    }
  };

  const resetOptimization = () => {
    setOptimizedDeliveries(deliveries);
    setOptimizationResult(null);
  };

  const handleCall = (customer: any) => {
    // Detect if user is on mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || window.innerWidth <= 768;

    if (isMobile) {
      // Use device's native phone app
      const phoneNumber = customer.phone.replace(/[^\d+]/g, ""); // Clean phone number
      window.location.href = `tel:${phoneNumber}`;

      toast({
        title: "Opening phone app",
        description: `Calling ${customer.customer_name} at ${customer.phone}`,
      });
    } else {
      setCallingCustomer(customer);
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
      `Hi ${name}, this is regarding your order.`
    );
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    window.open(whatsappUrl, "_blank");

    toast({
      title: "Opening WhatsApp",
      description: `Starting conversation with ${name}`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "in-progress":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "pending":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "in-progress":
        return <Activity className="h-4 w-4 text-amber-600 animate-pulse" />;
      case "pending":
        return <Clock className="h-4 w-4 text-slate-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-500" />;
    }
  };

  // Generate a better fallback name if customer_name is missing
  const getCustomerDisplayName = (delivery: DeliveryData) => {
    if (delivery.customer_name && delivery.customer_name.trim()) {
      return delivery.customer_name.trim();
    } else {
      return "N/A";
    }
  };
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const filteredDeliveries = optimizedDeliveries.filter(
    (delivery) =>
      getCustomerDisplayName(delivery)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (delivery.location?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (delivery.item?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getDeliveryProgress = (index: number) => {
    return Math.round(((index + 1) / filteredDeliveries.length) * 100);
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Enhanced Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 header-mobile">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg focus-enhanced"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center animate-fade-in">
                <Navigation className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {route.name}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-slate-600 mt-1 flex-wrap">
                  <span className="flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    {route.distance}
                  </span>
                  <span className="flex items-center">
                    <Timer className="h-4 w-4 mr-1" />
                    {route.duration}
                  </span>
                  <span className="flex items-center">
                    <Truck className="h-4 w-4 mr-1" />
                    {getDriverName(route.driver)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap">
            <Button
              variant={isLiveTrackingEnabled ? "default" : "outline"}
              className={`${
                isLiveTrackingEnabled
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
              } focus-enhanced`}
              onClick={() => setIsLiveTrackingEnabled(!isLiveTrackingEnabled)}
            >
              <Signal
                className={`h-4 w-4 mr-2 ${
                  isLiveTrackingEnabled ? "animate-pulse" : ""
                }`}
              />
              <span className="hidden sm:inline">Live Tracking</span>
              <span className="sm:hidden">Live</span>
            </Button>
            <Button
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 bg-white focus-enhanced"
            >
              <Clock className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Schedule</span>
            </Button>
            {optimizationResult && optimizedDeliveries !== deliveries && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1 animate-fade-in">
                <Zap className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Route Optimized</span>
                <span className="sm:hidden">Optimized</span>
              </Badge>
            )}
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1">
              <span className="hidden sm:inline">4 Active Routes</span>
              <span className="sm:hidden">4 Routes</span>
            </Badge>
          </div>
        </div>

        {/* Enhanced Stats with Progress */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 grid-responsive">
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow card-hover stats-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 hidden md:inline">
                    Total
                  </span>
                </div>
                <div className="text-2xl md:text-2xl font-bold text-slate-900 stat-number">
                  {totalDeliveries}
                </div>
              </div>
              <div className="text-xs text-slate-500">Total Deliveries</div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow card-hover stats-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 hidden md:inline">
                    Completed
                  </span>
                </div>
                <div className="text-2xl md:text-2xl font-bold text-emerald-600 stat-number">
                  {completedDeliveries}
                </div>
              </div>
              <Progress
                value={completionRate}
                className="h-1 bg-emerald-100 progress-enhanced"
              />
              <div className="text-xs text-emerald-600 mt-1">
                {completionRate}% complete
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow card-hover stats-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Activity className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 hidden md:inline">
                    In Progress
                  </span>
                </div>
                <div className="text-2xl md:text-2xl font-bold text-amber-600 stat-number">
                  {inProgressDeliveries}
                </div>
              </div>
              <div className="text-xs text-slate-500">Currently delivering</div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow card-hover stats-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-4 w-4 text-slate-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 hidden md:inline">
                    Pending
                  </span>
                </div>
                <div className="text-2xl md:text-2xl font-bold text-slate-600 stat-number">
                  {pendingDeliveries}
                </div>
              </div>
              <div className="text-xs text-slate-500">Awaiting delivery</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Enhanced Left Sidebar - Deliveries List */}
        <div className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shadow-sm h-full lg:h-auto max-h-96 lg:max-h-none">
          {/* Deliveries Header */}
          <div className="p-4 lg:p-6 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Today's Deliveries
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search deliveries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500 focus-enhanced"
              />
            </div>
          </div>

          {/* Enhanced Deliveries List - Improved Scrollable */}
          <div className="flex-1 scrollable-container mobile-scroll smooth-scroll min-h-0 relative">
            <div className="p-3 space-y-3 min-h-full">
              {filteredDeliveries.length > 0 ? (
                filteredDeliveries.map((delivery, index) => (
                  <Card
                    key={delivery.id}
                    className={`cursor-pointer border-2 transition-all duration-200 hover:shadow-md card-hover delivery-card ${
                      selectedDelivery?.id === delivery.id
                        ? "border-blue-200 bg-blue-50 shadow-md"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                    onClick={() => setSelectedDelivery(delivery)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`relative status-indicator status-${delivery.status}`}
                          >
                            {getStatusIcon(delivery.status)}
                            {delivery.status === "in-progress" && (
                              <div className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-900 text-sm block truncate">
                              {getCustomerDisplayName(delivery)}
                            </span>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Delivery #{delivery.id} • Stop {index + 1} of{" "}
                              {filteredDeliveries.length}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={`${getStatusColor(
                            delivery.status
                          )} text-xs px-2 py-1 flex-shrink-0`}
                        >
                          {delivery.status}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <MapPinIcon className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-slate-600 line-clamp-2 min-w-0">
                            {delivery.location || "Address not provided"}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Package className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-600 truncate min-w-0">
                            {delivery.item || "No item specified"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Clock className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-600 truncate">
                              {delivery.drop_time || "Not scheduled"}
                            </span>
                          </div>
                          {delivery.estimated_value && (
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <DollarSign className="h-3 w-3 text-emerald-600" />
                              <span className="text-xs font-medium text-emerald-600">
                                {delivery.estimated_value}
                              </span>
                            </div>
                          )}
                        </div>

                        {delivery.phone && (
                          <div className="flex items-center space-x-2 pt-1">
                            <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-600 truncate min-w-0">
                              {delivery.phone}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-auto flex-shrink-0"
                            >
                              <Phone className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {/* Progress Indicator */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Route Progress</span>
                            <span>{getDeliveryProgress(index)}%</span>
                          </div>
                          <Progress
                            value={getDeliveryProgress(index)}
                            className="h-1 progress-enhanced"
                          />
                        </div>
                      </div>

                      {selectedDelivery?.id === delivery.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 animate-fade-in">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 flex-shrink-0"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 flex-shrink-0"
                              onClick={() => handleCall(selectedDelivery)}
                            >
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </Button>
                            <ChevronRight className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-500">
                  <div className="text-center">
                    <Package className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">No deliveries found</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Bottom Actions */}
          <div className="p-4 lg:p-6 border-t border-slate-100 space-y-3 bg-slate-50 flex-shrink-0">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm btn-gradient focus-enhanced"
              onClick={() => setIsOptimizeDialogOpen(true)}
            >
              <Zap className="h-4 w-4 mr-2" />
              Optimize Routes
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 bg-white shadow-sm focus-enhanced"
            >
              <Users className="h-4 w-4 mr-2" />
              Assign Drivers
            </Button>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-900">
                  {route.distance}
                </div>
                <div className="text-xs text-slate-500">Total Distance</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-900">
                  {route.duration}
                </div>
                <div className="text-xs text-slate-500">Est. Duration</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Enhanced Map */}
        <div className="flex-1 bg-slate-50 relative map-mobile lg:h-auto h-96">
          <MapComponent
            deliveries={optimizedDeliveries}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
          />

          {/* Floating Map Controls */}
          <div className="absolute top-2 right-16 space-y-2">
            <Card className="bg-white/90 backdrop-blur-sm border border-white/20 shadow-2xl map-overlay rounded-none">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 text-sm flex-wrap">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-slate-600 text-xs">Completed</span>
                  <div className="h-2 w-2 bg-amber-500 rounded-full ml-3"></div>
                  <span className="text-slate-600 text-xs">In Progress</span>
                  <div className="h-2 w-2 bg-slate-400 rounded-full ml-3"></div>
                  <span className="text-slate-600 text-xs">Pending</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Driver Info Overlay */}
          <div className="absolute bottom-4 left-4">
            <Card className="bg-white/90 backdrop-blur-sm border border-white/20 shadow-2xl rounded-none map-overlay">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                      {getDriverName(route.driver).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">
                      {getDriverName(route.driver)}
                    </div>
                    <div className="text-sm text-slate-600 flex items-center">
                      <div
                        className={`h-2 w-2 rounded-full mr-2 ${
                          isLiveTrackingEnabled
                            ? "bg-green-500 animate-pulse"
                            : "bg-slate-400"
                        }`}
                      ></div>
                      <span className="text-xs">
                        {isLiveTrackingEnabled
                          ? "Live tracking active"
                          : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Contact Customer</DialogTitle>
          </DialogHeader>
          {callingCustomer && (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-gray-100 text-gray-700 text-xl">
                    {getInitials(callingCustomer.customer_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {callingCustomer.customer_name}
                  </h3>
                  <p className="text-gray-600">{callingCustomer.phone}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => copyPhoneNumber(callingCustomer.phone)}
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
                    openWhatsApp(
                      callingCustomer.phone,
                      callingCustomer.customer_name
                    )
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
      {/* Enhanced Route Optimization Dialog */}
      <Dialog
        open={isOptimizeDialogOpen}
        onOpenChange={setIsOptimizeDialogOpen}
      >
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] bg-white border-gray-200 z-[100] overflow-hidden">
          <DialogHeader className="pb-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 -m-6 mb-0 p-6">
            <DialogTitle className="text-gray-900 flex items-center text-2xl font-bold">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              Route Optimization
            </DialogTitle>
            <p className="text-gray-600 mt-2">
              Optimize your delivery routes for maximum efficiency and cost
              savings
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-6">
            <div className="space-y-8">
              {/* Current Route Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Total Stops
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {deliveries.length}
                        </p>
                      </div>
                      <Package className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Distance
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {route.distance || "0 km"}
                        </p>
                      </div>
                      <MapPin className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Duration
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {route.duration || "0h"}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Efficiency
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {route.efficiency ||
                            Math.round(60 + Math.random() * 25)}
                          %
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Algorithm Selection */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Optimization Settings
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-700 font-medium text-base">
                      Choose Optimization Algorithm
                    </Label>
                    <div className="grid grid-cols-1 gap-3 mt-3">
                      {[
                        {
                          value: "nearest-neighbor",
                          name: "Nearest Neighbor",
                          badge: "Fast",
                          badgeColor: "bg-green-100 text-green-800",
                          description:
                            "Quick optimization using nearest point selection. Best for simple routes.",
                          time: "~5 seconds",
                          improvement: "10-20%",
                        },
                        {
                          value: "2-opt",
                          name: "2-Opt Improvement",
                          badge: "Balanced",
                          badgeColor: "bg-blue-100 text-blue-800",
                          description:
                            "Improves routes by swapping segments. Good balance of speed and quality.",
                          time: "~15 seconds",
                          improvement: "15-30%",
                        },
                        {
                          value: "genetic",
                          name: "Genetic Algorithm",
                          badge: "Best",
                          badgeColor: "bg-purple-100 text-purple-800",
                          description:
                            "Advanced evolutionary optimization for maximum efficiency.",
                          time: "~30 seconds",
                          improvement: "25-40%",
                        },
                        {
                          value: "simulated-annealing",
                          name: "Simulated Annealing",
                          badge: "Advanced",
                          badgeColor: "bg-orange-100 text-orange-800",
                          description:
                            "Probabilistic method that avoids local optima.",
                          time: "~45 seconds",
                          improvement: "20-35%",
                        },
                      ].map((algorithm) => (
                        <div
                          key={algorithm.value}
                          className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedAlgorithm === algorithm.value
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                          onClick={() =>
                            setSelectedAlgorithm(
                              algorithm.value as typeof selectedAlgorithm
                            )
                          }
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-medium text-gray-900">
                                  {algorithm.name}
                                </h4>
                                <Badge
                                  className={`text-xs ${algorithm.badgeColor}`}
                                >
                                  {algorithm.badge}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {algorithm.description}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>⏱️ {algorithm.time}</span>
                                <span>📈 {algorithm.improvement} savings</span>
                              </div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                selectedAlgorithm === algorithm.value
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300"
                              }`}
                            >
                              {selectedAlgorithm === algorithm.value && (
                                <div className="w-full h-full rounded-full bg-white scale-50"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">
                        Optimization Constraints
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm text-gray-700">
                            Maximum route duration
                          </Label>
                          <Select defaultValue="8">
                            <SelectTrigger className="bg-white border-gray-300 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200 z-[110]">
                              <SelectItem value="4">4 hours</SelectItem>
                              <SelectItem value="6">6 hours</SelectItem>
                              <SelectItem value="8">8 hours</SelectItem>
                              <SelectItem value="10">10 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm text-gray-700">
                            Maximum stops per route
                          </Label>
                          <Select defaultValue="15">
                            <SelectTrigger className="bg-white border-gray-300 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200 z-[110]">
                              <SelectItem value="10">10 stops</SelectItem>
                              <SelectItem value="15">15 stops</SelectItem>
                              <SelectItem value="20">20 stops</SelectItem>
                              <SelectItem value="25">25 stops</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">
                        💡 Optimization Tips
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>
                          • Use Genetic Algorithm for best results on complex
                          routes
                        </li>
                        <li>
                          • Nearest Neighbor is perfect for time-sensitive
                          optimizations
                        </li>
                        <li>• Consider traffic patterns during peak hours</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleOptimizeRoute}
                    disabled={isOptimizing}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2.5 shadow-lg"
                    size="lg"
                  >
                    {isOptimizing ? (
                      <>
                        <Settings className="h-5 w-5 mr-2 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5 mr-2" />
                        Start Optimization
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Optimization Progress */}
              {isOptimizing && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Settings className="h-6 w-6 text-blue-600 animate-spin" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Optimizing Your Route...
                      </h3>
                      <p className="text-sm text-gray-600">
                        Analyzing delivery points and calculating optimal paths
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="text-gray-900 font-medium">65%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: "65%" }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Analyzing routes...</span>
                      <span>ETA: 15 seconds</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Optimization Results */}
              {optimizationResult && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center mb-6">
                    <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-green-900">
                        Optimization Complete! 🎉
                      </h3>
                      <p className="text-sm text-green-700">
                        Your route has been successfully optimized with
                        significant improvements
                      </p>
                    </div>
                  </div>

                  {/* Savings Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Distance Saved
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatDistance(
                              optimizationResult.originalDistance -
                                optimizationResult.optimizedDistance
                            )}
                          </p>
                        </div>
                        <MapPin className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        {Math.round(
                          ((optimizationResult.originalDistance -
                            optimizationResult.optimizedDistance) /
                            optimizationResult.originalDistance) *
                            100
                        )}
                        % reduction
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Time Saved
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatDuration(
                              optimizationResult.originalDuration -
                                optimizationResult.optimizedDuration
                            )}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        {Math.round(
                          ((optimizationResult.originalDuration -
                            optimizationResult.optimizedDuration) /
                            optimizationResult.originalDuration) *
                            100
                        )}
                        % faster
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Cost Savings
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            KSh{" "}
                            {Math.round(
                              (optimizationResult.originalDistance -
                                optimizationResult.optimizedDistance) *
                                50 +
                                (optimizationResult.originalDuration -
                                  optimizationResult.optimizedDuration) *
                                  10
                            ).toLocaleString()}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Per day savings
                      </p>
                    </div>
                  </div>

                  {/* Before/After Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        Original Route
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Distance:</span>
                          <span className="font-medium text-gray-900">
                            {formatDistance(
                              optimizationResult.originalDistance
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium text-gray-900">
                            {formatDuration(
                              optimizationResult.originalDuration
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fuel Cost:</span>
                          <span className="font-medium text-gray-900">
                            {formatCost(
                              optimizationResult.originalDistance * 50
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Driver Cost:</span>
                          <span className="font-medium text-gray-900">
                            {formatCost(
                              optimizationResult.originalDuration * 10
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-4 flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                        Optimized Route
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-green-700">Distance:</span>
                          <span className="font-medium text-green-900">
                            {formatDistance(
                              optimizationResult.optimizedDistance
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Duration:</span>
                          <span className="font-medium text-green-900">
                            {formatDuration(
                              optimizationResult.optimizedDuration
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Fuel Cost:</span>
                          <span className="font-medium text-green-900">
                            {formatCost(
                              optimizationResult.optimizedDistance * 50
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Driver Cost:</span>
                          <span className="font-medium text-green-900">
                            {formatCost(
                              optimizationResult.optimizedDuration * 10
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <Button
                      variant="outline"
                      onClick={resetOptimization}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Try Different Algorithm
                    </Button>
                    <Button
                      onClick={applyOptimization}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Apply Optimization
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
