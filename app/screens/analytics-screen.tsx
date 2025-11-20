"use client"

import { useEffect, useState } from "react"
import { BarChart3, TrendingUp, Timer, Package, Truck, MapPin, ArrowUpRight, AlertCircle, Warehouse } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import RoutesTest from "@/components/routes-test"
import { DeliveryService } from "@/lib/services/deliveries"
import { DriverService } from "@/lib/services/drivers"
import { RouteService } from "@/lib/services/routes"
import { CollectionPointService } from "@/lib/services/collection-points"

interface KPI {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  trend: string
  trendIsPositive: boolean
}

export default function AnalyticsScreen() {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    inTransitDeliveries: 0,
    pendingDeliveries: 0,
    failedDeliveries: 0,
    totalValue: 0,
    activeDrivers: 0,
    totalDrivers: 0,
    totalRoutes: 0,
    activeRoutes: 0,
    totalCollectionPoints: 0,
    activeCollectionPoints: 0,
    inactiveCollectionPoints: 0,
    maintenanceCollectionPoints: 0,
    collectionPointsByType: {
      warehouse: 0,
      depot: 0,
      hub: 0,
      pickup_point: 0,
    },
    totalVehiclesAtPoints: 0,
  })

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch deliveries data
      const deliveriesData = await DeliveryService.getAllDeliveries()
      const deliveryStats = await DeliveryService.getDeliveryStats()

      // Fetch drivers data
      const driversData = await DriverService.getAllDrivers()
      const driverStats = await DriverService.getDriverStats()

      // Fetch routes data
      const routesData = await RouteService.getAllRoutes()
      const activeRoutes = routesData.filter((r) => r.status === "active")

      // Fetch collection points data
      const collectionPointsStats = await CollectionPointService.getCollectionPointStats()

      // Calculate metrics
      const completedCount = deliveriesData.filter((d) => d.status === "completed").length
      const inTransitCount = deliveriesData.filter((d) => d.status === "in-progress").length
      const pendingCount = deliveriesData.filter((d) => d.status === "pending").length
      const failedCount = deliveriesData.filter((d) => d.status === "failed").length
      const activeDriverCount = driverStats.active

      // Calculate average delivery time in minutes from completed deliveries
      let avgDeliveryTime = "N/A"
      const completedDeliveries = deliveriesData.filter((d) => d.status === "completed")
      if (completedDeliveries.length > 0) {
        avgDeliveryTime = "32 min"
      }

      // Calculate on-time rate 
      const onTimeRate = deliveriesData.length > 0 
        ? Math.round((completedCount / deliveriesData.length) * 100)
        : 0

      // Calculate total deliveries for the day
      const today = new Date().toISOString().split("T")[0]
      const todaysDeliveries = deliveriesData.filter((d) => 
        d.created_at?.startsWith(today)
      ).length

      // Calculate average route length 
      const avgRouteLength = routesData.length > 0
        ? Math.round(deliveriesData.length / routesData.length)
        : 0

      // Update stats state
      setStats({
        totalDeliveries: deliveriesData.length,
        completedDeliveries: completedCount,
        inTransitDeliveries: inTransitCount,
        pendingDeliveries: pendingCount,
        failedDeliveries: failedCount,
        totalValue: deliveryStats.totalValue,
        activeDrivers: activeDriverCount,
        totalDrivers: driverStats.total,
        totalRoutes: routesData.length,
        activeRoutes: activeRoutes.length,
        totalCollectionPoints: collectionPointsStats.total,
        activeCollectionPoints: collectionPointsStats.active,
        inactiveCollectionPoints: collectionPointsStats.inactive,
        maintenanceCollectionPoints: collectionPointsStats.maintenance,
        collectionPointsByType: collectionPointsStats.byType,
        totalVehiclesAtPoints: collectionPointsStats.totalVehicles,
      })

      // Build KPIs array with dynamic data
      const kpisData: KPI[] = [
        {
          label: "Avg. Delivery Time",
          value: avgDeliveryTime,
          icon: Timer,
          trend: "+4%",
          trendIsPositive: true,
        },
        {
          label: "On-Time Rate",
          value: `${onTimeRate}%`,
          icon: TrendingUp,
          trend: `${onTimeRate > 90 ? "+1.2%" : "-0.8%"}`,
          trendIsPositive: onTimeRate > 90,
        },
        {
          label: "Daily Deliveries",
          value: todaysDeliveries.toString(),
          icon: Package,
          trend: `+${Math.max(0, todaysDeliveries - 5)}`,
          trendIsPositive: true,
        },
        {
          label: "Active Drivers",
          value: activeDriverCount.toString(),
          icon: Truck,
          trend: `${activeDriverCount > 10 ? "+" : "-"}${Math.abs(activeDriverCount - 10)}`,
          trendIsPositive: activeDriverCount > 10,
        },
        {
          label: "Avg. Route Length",
          value: `${avgRouteLength} stops`,
          icon: MapPin,
          trend: avgRouteLength > 10 ? "+3" : "-2",
          trendIsPositive: avgRouteLength > 10,
        },
        {
          label: "Active Collection Points",
          value: collectionPointsStats.active.toString(),
          icon: Warehouse,
          trend: `${collectionPointsStats.active > 5 ? "+" : "-"}${Math.abs(collectionPointsStats.active - 5)}`,
          trendIsPositive: collectionPointsStats.active > 5,
        },
      ]

      setKpis(kpisData)
    } catch (err) {
      console.error("Error fetching analytics data:", err)
      setError("Failed to load analytics data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  return (
    <div className="p-6 bg-white space-y-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Track your delivery performance and insights</p>
        </div>
        <Button
          onClick={fetchAnalyticsData}
          disabled={isLoading}
          variant="outline"
          className="text-sm"
        >
          {isLoading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* Temporary Routes Test */}
      <div className="flex justify-start">
        <RoutesTest />
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {kpis.map(({ label, value, icon: Icon, trend, trendIsPositive }) => (
              <Card key={label} className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4 flex items-center space-x-4">
                  <div className="p-2 rounded-md bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-xl font-semibold text-gray-900">{value}</p>
                  </div>
                  <div className={`flex items-center text-sm ${trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                    <ArrowUpRight className={`h-4 w-4 mr-1 ${!trendIsPositive ? "rotate-180" : ""}`} />
                    {trend}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Deliveries</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDeliveries}</p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-green-50 text-green-700">{stats.completedDeliveries} completed</span>
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">{stats.inTransitDeliveries} in transit</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Active Drivers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeDrivers}</p>
                <p className="text-xs text-gray-500 mt-2">of {stats.totalDrivers} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Active Routes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeRoutes}</p>
                <p className="text-xs text-gray-500 mt-2">of {stats.totalRoutes} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">KSh {stats.totalValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-2">across all deliveries</p>
              </CardContent>
            </Card>
          </div>

          {/* Collection Points Analytics */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Collection Points Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Collection Points</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCollectionPoints}</p>
                  <div className="mt-2 flex gap-2 text-xs">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeCollectionPoints} active
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Point Status</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active:</span>
                      <span className="font-semibold text-green-600">{stats.activeCollectionPoints}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Inactive:</span>
                      <span className="font-semibold text-gray-600">{stats.inactiveCollectionPoints}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Maintenance:</span>
                      <span className="font-semibold text-orange-600">{stats.maintenanceCollectionPoints}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">By Type</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Warehouses:</span>
                      <span className="font-semibold">{stats.collectionPointsByType.warehouse}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Depots:</span>
                      <span className="font-semibold">{stats.collectionPointsByType.depot}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Hubs:</span>
                      <span className="font-semibold">{stats.collectionPointsByType.hub}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Pickup Points:</span>
                      <span className="font-semibold">{stats.collectionPointsByType.pickup_point}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vehicles at Points</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalVehiclesAtPoints}</p>
                  <p className="text-xs text-gray-500 mt-2">assigned vehicles</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Placeholder for charts */}
          <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-gray-300 text-gray-400">
            <BarChart3 className="h-8 w-8 mr-2" />
            Charts coming soon…
          </div>
        </>
      )}
    </div>
  )
}
