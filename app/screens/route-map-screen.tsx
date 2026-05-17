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
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Filter, Share2 } from "lucide-react";
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
import MapComponent from "@/components/map-component";
import {
  optimizeRoute,
  formatDistance,
  formatDuration,
  formatCost,
} from "@/lib/route-optimization";
import { toast } from "@/hooks/use-toast";
import { useDriverLocations } from "@/hooks/use-driver-locations";
import { DeliveryService } from "@/lib/services/deliveries";

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
  const [callingCustomer, setCallingCustomer] = useState<DeliveryData | null>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [recommendedDeliveries, setRecommendedDeliveries] = useState<any[]>([]);
  const [showRecommended, setShowRecommended] = useState(false);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Get driver ID for location tracking
  const driverId =
    route.driver && typeof route.driver === "object" ? route.driver.id : undefined;

  // Real-time driver location tracking
  const { locations: driverLocations, isConnected } = useDriverLocations({
    routeId: driverId ? undefined : undefined, // Track all drivers, filter in UI
    enabled: isLiveTrackingEnabled,
  });

  // Fetch recommended unassigned deliveries for this route
  const loadRecommendedDeliveries = async () => {
    if (!route.id) return;
    setLoadingRecommended(true);
    try {
      const scored = await DeliveryService.getUnassignedDeliveries(route.id, 5);
      setRecommendedDeliveries(scored);
    } catch (error) {
      console.error("Error loading recommended deliveries:", error);
    } finally {
      setLoadingRecommended(false);
    }
  };

  useEffect(() => {
    if (showRecommended) {
      loadRecommendedDeliveries();
    }
  }, [showRecommended, route.id]);

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

  const applyOptimization = async () => {
    if (optimizationResult) {
      const optimized = optimizationResult.optimizedOrder as DeliveryData[];
      setOptimizedDeliveries(optimized);
      setIsOptimizeDialogOpen(false);

      // Persist the new order to the backend
      try {
        const orderUpdates = optimized.map((d: DeliveryData, index: number) => ({
          id: d.id,
          order_index: index,
        }));
        await DeliveryService.updateDeliveryOrder(orderUpdates);
        toast({
          title: "Optimization applied",
          description: `Saved optimized order for ${orderUpdates.length} stops.`,
        });
      } catch (error) {
        console.error("Failed to persist optimized order:", error);
        toast({
          title: "Order saved locally",
          description: "Could not save to server. Changes are local only.",
          variant: "destructive",
        });
      }
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

  function buildWhatsAppMessage(route: any, deliveries: any[]) {
    const driverName = route.driver?.name || "Driver";
    const start = route.start_location || "Not set";
    const end = route.end_location || "Not set";

    // Header
    let message = `Hi ${driverName}, 👋\n\nHere are your deliveries for today:\n\n`;
    message += `🚦 Starting point: ${start}\n🏁 End point: ${end}\n\n`;

    // Deliveries list
    deliveries.forEach((d, i) => {
      message += `#${i + 1}. ${d.customer_name} - ${d.item}\n📍 ${
        d.location
      }\n📞 ${d.phone}\n🕒 Drop time: ${d.drop_time || "N/A"}\n\n`;
    });

    message += "✅ Please confirm once completed. Safe ride!";

    // WhatsApp URL encode
    return encodeURIComponent(message);
  }

  const handleShare = () => {
    const msg = buildWhatsAppMessage(route, deliveries);
    const driver = route.driver;
    const phone = typeof driver === 'object' && driver !== null ? driver.phone : undefined;
    const url = `https://wa.me/${phone}?text=${msg}`;
    window.open(url, "_blank");
  };


  

  // Determine "up next" — first pending delivery index
  const upNextIndex = filteredDeliveries.findIndex((d) => d.status === "pending");

  return (
    <div className="h-full relative overflow-hidden">
      {/* Full-screen map background */}
      <div className="absolute inset-0">
        <MapComponent
          deliveries={optimizedDeliveries}
          selectedDelivery={selectedDelivery}
          onDeliverySelect={setSelectedDelivery}
          driverLocations={isLiveTrackingEnabled ? driverLocations : undefined}
          showDrivers={isLiveTrackingEnabled}
          routeId={route.id}
          candidateDeliveries={showRecommended ? recommendedDeliveries : undefined}
        />
      </div>

      {/* Floating card overlay */}
      <div className="absolute top-4 left-4 bottom-4 w-[380px] bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col z-10 overflow-hidden">

        {/* Card header: BACK + route name + stats */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            BACK
          </button>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{route.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5" />
              {route.distance}
            </span>
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              {route.duration}
            </span>
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {totalDeliveries} stops
            </span>
          </div>
        </div>

        {/* Deliveries header + search */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Todays Deliveries</h3>
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search deliveries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Deliveries list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 py-2">
            {filteredDeliveries.length > 0 ? (
              filteredDeliveries.map((delivery, index) => {
                const isCompleted  = delivery.status === "completed";
                const isInProgress = delivery.status === "in-progress";
                const isUpNext     = !isCompleted && !isInProgress && index === upNextIndex;
                const stopNum      = String(index + 1).padStart(2, "0");

                return (
                  <div
                    key={delivery.id}
                    onClick={() => setSelectedDelivery(delivery)}
                    className={`py-4 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                      selectedDelivery?.id === delivery.id ? "bg-emerald-50/20" : "hover:bg-gray-50/50"
                    }`}
                  >
                    {/* Stop header row */}
                    <div className="flex items-start gap-3">
                      {isCompleted ? (
                        <Home className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <div className="h-7 w-7 rounded-full border-2 border-gray-900 bg-white flex items-center justify-center shrink-0">
                          <span className="text-gray-900 text-[10px] font-bold">{stopNum}</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold leading-snug ${isCompleted ? "text-gray-400" : "text-gray-900"}`}>
                            {delivery.location || "No location"}
                          </p>
                          {isCompleted && (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Completed
                            </span>
                          )}
                          {isInProgress && (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                              In Progress
                            </span>
                          )}
                          {isUpNext && (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              Up Next
                            </span>
                          )}
                        </div>

                        {isCompleted ? (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Picked up at {delivery.drop_time || "—"}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Expected: {delivery.drop_time || "—"}
                          </p>
                        )}
                      </div>
                    </div>

                    {isInProgress && (
                      <div className="mt-3 ml-8 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-emerald-500 rounded-full" />
                          <Truck className="h-4 w-4 text-gray-500 shrink-0" />
                          <div className="flex-1 h-px border-t-2 border-dashed border-gray-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div>
                            <p className="text-gray-400 text-[10px] font-semibold uppercase">Customer Name</p>
                            <p className="text-gray-900 font-semibold mt-0.5">{getCustomerDisplayName(delivery)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-[10px] font-semibold uppercase">Order Number</p>
                            <p className="text-gray-900 font-semibold mt-0.5">#{delivery.id}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-400 text-[10px] font-semibold uppercase">Customer Phone</p>
                            <p className="text-gray-900 font-semibold mt-0.5">{delivery.phone || "—"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <Package className="h-8 w-8 mb-2 text-gray-300" />
                <p className="text-sm">No deliveries found</p>
              </div>
            )}
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
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] bg-white border-[#162318]/10 z-[100] overflow-hidden">
          <DialogHeader className="pb-6 border-b border-[#162318]/10 bg-[#EFF0EB] -m-6 mb-0 p-6">
            <DialogTitle className="text-[#162318] flex items-center text-2xl font-bold">
              <div className="h-10 w-10 bg-[#C8E298]/30 rounded-lg flex items-center justify-center mr-3">
                <Zap className="h-6 w-6 text-[#162318]" />
              </div>
              Route Optimization
            </DialogTitle>
            <p className="text-[#162318]/60 mt-2">
              Optimize your delivery routes for maximum efficiency and cost
              savings
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-6">
            <div className="space-y-8">
              {/* Current Route Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border border-[#162318]/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#162318]/50">
                          Total Stops
                        </p>
                        <p className="text-2xl font-bold text-[#162318]">
                          {deliveries.length}
                        </p>
                      </div>
                      <Package className="h-8 w-8 text-[#C8E298]" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-[#162318]/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#162318]/50">
                          Distance
                        </p>
                        <p className="text-2xl font-bold text-[#162318]">
                          {route.distance || "0 km"}
                        </p>
                      </div>
                      <MapPin className="h-8 w-8 text-[#C8E298]" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-[#162318]/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#162318]/50">
                          Duration
                        </p>
                        <p className="text-2xl font-bold text-[#162318]">
                          {route.duration || "0h"}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-[#C97C5D]" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border border-[#162318]/10">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#162318]/50">
                          Efficiency
                        </p>
                        <p className="text-2xl font-bold text-[#162318]">
                          {route.efficiency ||
                            Math.round(60 + Math.random() * 25)}
                          %
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-[#274690]" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Algorithm Selection */}
              <div className="bg-white border border-[#162318]/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-[#162318] mb-4 flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-[#274690]" />
                  Optimization Settings
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[#162318]/70 font-medium text-base">
                      Choose Optimization Algorithm
                    </Label>
                    <div className="grid grid-cols-1 gap-3 mt-3">
                      {[
                        {
                          value: "nearest-neighbor",
                          name: "Nearest Neighbor",
                          badge: "Fast",
                          badgeColor: "bg-[#C8E298]/30 text-[#162318]",
                          description:
                            "Quick optimization using nearest point selection. Best for simple routes.",
                          time: "~5 seconds",
                          improvement: "10-20%",
                        },
                        {
                          value: "2-opt",
                          name: "2-Opt Improvement",
                          badge: "Balanced",
                          badgeColor: "bg-[#274690]/15 text-[#274690]",
                          description:
                            "Improves routes by swapping segments. Good balance of speed and quality.",
                          time: "~15 seconds",
                          improvement: "15-30%",
                        },
                        {
                          value: "genetic",
                          name: "Genetic Algorithm",
                          badge: "Best",
                          badgeColor: "bg-[#C8E298] text-[#162318]",
                          description:
                            "Advanced evolutionary optimization for maximum efficiency.",
                          time: "~30 seconds",
                          improvement: "25-40%",
                        },
                        {
                          value: "simulated-annealing",
                          name: "Simulated Annealing",
                          badge: "Advanced",
                          badgeColor: "bg-[#C97C5D]/20 text-[#C97C5D]",
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
                              ? "border-[#C8E298] bg-[#C8E298]/10"
                              : "border-[#162318]/10 hover:border-[#162318]/20 bg-white"
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
                                <h4 className="font-medium text-[#162318]">
                                  {algorithm.name}
                                </h4>
                                <Badge
                                  className={`text-xs ${algorithm.badgeColor}`}
                                >
                                  {algorithm.badge}
                                </Badge>
                              </div>
                              <p className="text-sm text-[#162318]/60 mb-2">
                                {algorithm.description}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-[#162318]/50">
                                <span>⏱️ {algorithm.time}</span>
                                <span>📈 {algorithm.improvement} savings</span>
                              </div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                selectedAlgorithm === algorithm.value
                                  ? "border-[#C8E298] bg-[#C8E298]"
                                  : "border-[#162318]/20"
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
                      <h4 className="font-medium text-[#162318] mb-3">
                        Optimization Constraints
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm text-[#162318]/70">
                            Maximum route duration
                          </Label>
                          <Select defaultValue="8">
                            <SelectTrigger className="bg-white border-[#162318]/20 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#162318]/10 z-[110]">
                              <SelectItem value="4">4 hours</SelectItem>
                              <SelectItem value="6">6 hours</SelectItem>
                              <SelectItem value="8">8 hours</SelectItem>
                              <SelectItem value="10">10 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm text-[#162318]/70">
                            Maximum stops per route
                          </Label>
                          <Select defaultValue="15">
                            <SelectTrigger className="bg-white border-[#162318]/20 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#162318]/10 z-[110]">
                              <SelectItem value="10">10 stops</SelectItem>
                              <SelectItem value="15">15 stops</SelectItem>
                              <SelectItem value="20">20 stops</SelectItem>
                              <SelectItem value="25">25 stops</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#EFF0EB] p-4 rounded-lg">
                      <h4 className="font-medium text-[#162318] mb-2">
                        Optimization Tips
                      </h4>
                      <ul className="text-sm text-[#162318]/70 space-y-1">
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
                    className="bg-[#C8E298] hover:bg-[#274690] text-[#162318] hover:text-white px-8 py-2.5"
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
                <div className="bg-[#EFF0EB] border border-[#162318]/10 rounded-lg p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-12 w-12 bg-[#C8E298]/30 rounded-lg flex items-center justify-center">
                      <Settings className="h-6 w-6 text-[#274690] animate-spin" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#162318]">
                        Optimizing Your Route...
                      </h3>
                      <p className="text-sm text-[#162318]/60">
                        Analyzing delivery points and calculating optimal paths
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#162318]/60">Progress</span>
                      <span className="text-[#162318] font-medium">65%</span>
                    </div>
                    <div className="w-full bg-[#162318]/10 rounded-full h-2">
                      <div
                        className="bg-[#C8E298] h-2 rounded-full transition-all duration-500"
                        style={{ width: "65%" }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-[#162318]/50">
                      <span>Analyzing routes...</span>
                      <span>ETA: 15 seconds</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Optimization Results */}
              {optimizationResult && (
                <div className="bg-[#C8E298]/10 border border-[#C8E298]/30 rounded-lg p-6">
                  <div className="flex items-center mb-6">
                    <div className="h-12 w-12 bg-[#C8E298]/30 rounded-lg flex items-center justify-center mr-4">
                      <CheckCircle className="h-6 w-6 text-[#162318]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[#162318]">
                        Optimization Complete!
                      </h3>
                      <p className="text-sm text-[#162318]/70">
                        Your route has been successfully optimized with
                        significant improvements
                      </p>
                    </div>
                  </div>

                  {/* Savings Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-[#162318]/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#162318]/50">
                            Distance Saved
                          </p>
                          <p className="text-2xl font-bold text-[#C8E298]">
                            {formatDistance(
                              optimizationResult.originalDistance -
                                optimizationResult.optimizedDistance
                            )}
                          </p>
                        </div>
                        <MapPin className="h-8 w-8 text-[#C8E298]" />
                      </div>
                      <p className="text-xs text-[#162318]/50 mt-1">
                        {Math.round(
                          ((optimizationResult.originalDistance -
                            optimizationResult.optimizedDistance) /
                            optimizationResult.originalDistance) *
                            100
                        )}
                        % reduction
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-[#162318]/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#162318]/50">
                            Time Saved
                          </p>
                          <p className="text-2xl font-bold text-[#274690]">
                            {formatDuration(
                              optimizationResult.originalDuration -
                                optimizationResult.optimizedDuration
                            )}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-[#274690]" />
                      </div>
                      <p className="text-xs text-[#162318]/50 mt-1">
                        {Math.round(
                          ((optimizationResult.originalDuration -
                            optimizationResult.optimizedDuration) /
                            optimizationResult.originalDuration) *
                            100
                        )}
                        % faster
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-[#162318]/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#162318]/50">
                            Cost Savings
                          </p>
                          <p className="text-2xl font-bold text-[#C97C5D]">
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
                        <TrendingUp className="h-8 w-8 text-[#C97C5D]" />
                      </div>
                      <p className="text-xs text-[#162318]/50 mt-1">
                        Per day savings
                      </p>
                    </div>
                  </div>

                  {/* Before/After Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white p-6 rounded-lg border border-[#162318]/10">
                      <h4 className="font-semibold text-[#162318] mb-4 flex items-center">
                        <div className="w-3 h-3 bg-[#C97C5D] rounded-full mr-2"></div>
                        Original Route
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Distance:</span>
                          <span className="font-medium text-[#162318]">
                            {formatDistance(
                              optimizationResult.originalDistance
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Duration:</span>
                          <span className="font-medium text-[#162318]">
                            {formatDuration(
                              optimizationResult.originalDuration
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Fuel Cost:</span>
                          <span className="font-medium text-[#162318]">
                            {formatCost(
                              optimizationResult.originalDistance * 50
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Driver Cost:</span>
                          <span className="font-medium text-[#162318]">
                            {formatCost(
                              optimizationResult.originalDuration * 10
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#C8E298]/15 p-6 rounded-lg border border-[#C8E298]/30">
                      <h4 className="font-semibold text-[#162318] mb-4 flex items-center">
                        <div className="w-3 h-3 bg-[#C8E298] rounded-full mr-2"></div>
                        Optimized Route
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Distance:</span>
                          <span className="font-medium text-[#162318]">
                            {formatDistance(
                              optimizationResult.optimizedDistance
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Duration:</span>
                          <span className="font-medium text-[#162318]">
                            {formatDuration(
                              optimizationResult.optimizedDuration
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Fuel Cost:</span>
                          <span className="font-medium text-[#162318]">
                            {formatCost(
                              optimizationResult.optimizedDistance * 50
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#162318]/60">Driver Cost:</span>
                          <span className="font-medium text-[#162318]">
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
                      className="border-[#162318]/20 text-[#162318]/70 hover:bg-[#EFF0EB] bg-white"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Try Different Algorithm
                    </Button>
                    <Button
                      onClick={applyOptimization}
                      className="bg-[#C8E298] hover:bg-[#274690] text-[#162318] hover:text-white"
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