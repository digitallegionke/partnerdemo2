"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Activity,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeliveryService } from "@/lib/services/deliveries";
import { DriverService } from "@/lib/services/drivers";
import type { Database } from "@/lib/supabase";

type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
// const deliveries = [
//   { id: "DEL-001", location: "Kiambu", status: "pending" },
//   { id: "DEL-002", location: "Thika", status: "pending" },
//   { id: "DEL-003", location: "Ruiru", status: "pending" },
// ]

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

  // Generate a better fallback name if customer_name is missing

  return {
    id: `DEL-${(delivery.id || 0).toString().padStart(3, "0")}`,
    recipient:
      delivery.customer_name && delivery.customer_name.trim()
        ? delivery.customer_name.trim()
        : "",
    address: delivery.location || "Address not provided",
    phone: delivery.phone || "Not provided",
    status: mapStatus(delivery.status || "pending"),
    driver: "Unassigned", // TODO: Add driver assignment logic
    driverAvatar: "UN",
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

export default function AssignDriversScreen() {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async (deliveryId: number, driverId: number | null) => {
    setAssignments((a) => ({ ...a, [deliveryId]: driverId }));
    const selectedDelivery = deliveries.find(
      (delivery) => deliveryId === delivery.id
    );
    const deliveryData = { ...selectedDelivery, assigned_to: driverId };

    await DeliveryService.updateDelivery(deliveryId, deliveryData);

    
  };

  const loadDrivers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DriverService.getAllDrivers();

      setDrivers(data);

      // Calculate stats
    } catch (err) {
      console.error("Error loading drivers:", err);
      setError("Failed to load drivers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeliveries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DeliveryService.getAllDeliveries();

      setDeliveries(data);
    } catch (err) {
      console.error("Error loading deliveries:", err);
      setError("Failed to load deliveries. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
    loadDeliveries();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in-transit":
        return <Activity className="h-4 w-4 text-[#C8E298]" />;
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
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

  return (
    <div className="p-6 bg-white space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deliveries.map((d) => (
          <Card key={d.id} className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center truncate">
                <MapPin className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />
                {d.location}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">DEL-{d.id}</span>
                <Badge
                  variant="outline"
                  className={getStatusColor(mapStatus(d.status))}
                >
                  {mapStatus(d.status)}
                </Badge>
              </div>

              <Select
                value={assignments[d.id] ?? ""}
                onValueChange={(val) => handleAssign(d.id, parseInt(val))}
              >
                <SelectTrigger className="w-full bg-white border-gray-300">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {assignments[d.id] && (
                <div className="flex items-center justify-between text-sm text-green-700">
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Assigned to{" "}
                    {drivers.find((dr) => dr.id === assignments[d.id])?.name}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAssign(d.id, null)}
                    className="border-gray-300 bg-white"
                  >
                    Unassign
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
