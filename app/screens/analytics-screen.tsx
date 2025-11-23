"use client"

import { useEffect, useState } from "react"
import { BarChart3, TrendingUp, Timer, Package, Truck, MapPin, ArrowUpRight, AlertCircle, Warehouse, Calendar, DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import RoutesTest from "@/components/routes-test"
import { DeliveryService } from "@/lib/services/deliveries"
import { DriverService } from "@/lib/services/drivers"
import { RouteService } from "@/lib/services/routes"
import { CollectionPointService } from "@/lib/services/collection-points"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  // Label,
} from "recharts"

interface KPI {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  trend: string
  trendIsPositive: boolean
  hasZeroTrend?: boolean
}

export default function AnalyticsScreen() {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Date range state - default to today vs yesterday
  const getYesterdayDate = () => {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return date.toISOString().split("T")[0]
  }
  
  const getTodayDate = () => new Date().toISOString().split("T")[0]

  const [compareStartDate, setCompareStartDate] = useState("")
  const [compareEndDate, setCompareEndDate] = useState("")
  
  // Initialize dates on client side only
  useEffect(() => {
    if (!isInitialized) {
      setCompareStartDate(getYesterdayDate())
      setCompareEndDate(getTodayDate())
      setIsInitialized(true)
    }
  }, [isInitialized])
  
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
    secondPeriodCollectionPointsLength: 0,
    secondPeriodActiveCollectionPoints: 0,
    secondPeriodActiveDrivers: 0,
  })

  const [collectionPointsTotalTrend, setCollectionPointsTotalTrend] = useState({
    trend: "0",
    isPositive: false,
    hasZeroTrend: true,
  })

  const [periodValues, setPeriodValues] = useState({
    firstPeriodValue: 0,
    secondPeriodValue: 0,
    monthlyValues: [] as Array<{ month: string; value: number }>,
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
      const collectionPointsData = await CollectionPointService.getAllCollectionPoints()

      // Calculate metrics for current period
      const completedCount = deliveriesData.filter((d) => d.status === "completed").length
      const inTransitCount = deliveriesData.filter((d) => d.status === "in-progress").length
      const pendingCount = deliveriesData.filter((d) => d.status === "pending").length
      const failedCount = deliveriesData.filter((d) => d.status === "failed").length
      const activeDriverCount = driverStats.active

      // Get deliveries for a specific date
      const getDeliveriesForDate = (date: string) => {
        return deliveriesData.filter(
          (d) => d.created_at && d.created_at.startsWith(date)
        )
      }

      // Get deliveries for a date range (inclusive)
      const getDeliveriesForDateRange = (startDate: string, endDate: string) => {
        return deliveriesData.filter(
          (d) =>
            d.created_at &&
            d.created_at >= `${startDate}T00:00:00` &&
            d.created_at <= `${endDate}T23:59:59`
        )
      }

      // Determine if we're comparing specific dates or a range
      const isComparingConsecutiveDays = 
        new Date(compareEndDate).getTime() - new Date(compareStartDate).getTime() === 24 * 60 * 60 * 1000

      let firstPeriodDeliveries: any[] = []
      let secondPeriodDeliveries: any[] = []

      if (isComparingConsecutiveDays) {
        // If comparing consecutive days (e.g., yesterday vs today), compare each day
        firstPeriodDeliveries = getDeliveriesForDate(compareStartDate)
        secondPeriodDeliveries = getDeliveriesForDate(compareEndDate)
      } else {
        // Otherwise split the range in half
        const rangeStart = new Date(compareStartDate)
        const rangeEnd = new Date(compareEndDate)
        const midPoint = new Date(rangeStart.getTime() + (rangeEnd.getTime() - rangeStart.getTime()) / 2)
        const midDateStr = midPoint.toISOString().split("T")[0]

        firstPeriodDeliveries = getDeliveriesForDateRange(compareStartDate, midDateStr)
        secondPeriodDeliveries = getDeliveriesForDateRange(
          new Date(midPoint.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          compareEndDate
        )
      }

      // Calculate trends
      const calculateTrend = (currentValue: number, previousValue: number) => {
        if (previousValue === 0) {
          if (currentValue === 0) {
            return { trend: "0", isPositive: false, hasZeroTrend: true }
          }
          return { trend: currentValue > 0 ? `+${currentValue}` : "0", isPositive: currentValue > 0, hasZeroTrend: false }
        }
        const percentChange = Math.round(((currentValue - previousValue) / previousValue) * 100)
        
        if (percentChange === 0) {
          return { trend: "0", isPositive: false, hasZeroTrend: true }
        }
        
        const trendStr = percentChange >= 0 ? `+${percentChange}%` : `${percentChange}%`
        return { trend: trendStr, isPositive: percentChange > 0, hasZeroTrend: false }
      }

      // Calculate metrics for each period
      const firstPeriodCompleted = firstPeriodDeliveries.filter((d) => d.status === "completed").length
      const secondPeriodCompleted = secondPeriodDeliveries.filter((d) => d.status === "completed").length
      const completedTrend = calculateTrend(secondPeriodCompleted, firstPeriodCompleted)

      const firstPeriodOnTime = firstPeriodDeliveries.length > 0 ? Math.round((firstPeriodCompleted / firstPeriodDeliveries.length) * 100) : 0
      const secondPeriodOnTime = secondPeriodDeliveries.length > 0 ? Math.round((secondPeriodCompleted / secondPeriodDeliveries.length) * 100) : 0
      const onTimeTrend = calculateTrend(secondPeriodOnTime, firstPeriodOnTime)

      const deliveryTimeTrend = calculateTrend(secondPeriodDeliveries.length, firstPeriodDeliveries.length)

      const firstPeriodAvgRoute = routesData.length > 0 ? Math.round(firstPeriodDeliveries.length / routesData.length) : 0
      const secondPeriodAvgRoute = routesData.length > 0 ? Math.round(secondPeriodDeliveries.length / routesData.length) : 0
      const routeTrend = calculateTrend(secondPeriodAvgRoute, firstPeriodAvgRoute)

      // Calculate drivers trend based on date periods
      const getDriversForDate = (date: string) => {
        return driversData.filter(
          (d) => d.created_at && d.created_at.startsWith(date)
        )
      }

      const getDriversForDateRange = (startDate: string, endDate: string) => {
        return driversData.filter(
          (d) =>
            d.created_at &&
            d.created_at >= `${startDate}T00:00:00` &&
            d.created_at <= `${endDate}T23:59:59`
        )
      }

      let firstPeriodDrivers: any[] = []
      let secondPeriodDrivers: any[] = []

      if (isComparingConsecutiveDays) {
        firstPeriodDrivers = getDriversForDate(compareStartDate)
        secondPeriodDrivers = getDriversForDate(compareEndDate)
      } else {
        const rangeStart = new Date(compareStartDate)
        const rangeEnd = new Date(compareEndDate)
        const midPoint = new Date(rangeStart.getTime() + (rangeEnd.getTime() - rangeStart.getTime()) / 2)
        const midDateStr = midPoint.toISOString().split("T")[0]

        firstPeriodDrivers = getDriversForDateRange(compareStartDate, midDateStr)
        secondPeriodDrivers = getDriversForDateRange(
          new Date(midPoint.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          compareEndDate
        )
      }

      const firstPeriodActiveDrivers = firstPeriodDrivers.filter((d) => d.status === "active").length
      const secondPeriodActiveDrivers = secondPeriodDrivers.filter((d) => d.status === "active").length
      const driversTrend = calculateTrend(secondPeriodActiveDrivers, firstPeriodActiveDrivers)

      // Calculate collection points trend based on date periods
      // For total collection points, we count all points that were created by the end of each period
      const getCollectionPointsCreatedByDate = (beforeDate: string) => {
        return collectionPointsData.filter(
          (cp) =>
            cp.created_at &&
            cp.created_at <= `${beforeDate}T23:59:59`
        )
      }

      const firstPeriodEndDate = isComparingConsecutiveDays 
        ? compareStartDate
        : (() => {
            const rangeStart = new Date(compareStartDate)
            const rangeEnd = new Date(compareEndDate)
            const midPoint = new Date(rangeStart.getTime() + (rangeEnd.getTime() - rangeStart.getTime()) / 2)
            return midPoint.toISOString().split("T")[0]
          })()

      const secondPeriodEndDate = compareEndDate

      const firstPeriodCollectionPointsTotal = getCollectionPointsCreatedByDate(firstPeriodEndDate)
      const secondPeriodCollectionPointsTotal = getCollectionPointsCreatedByDate(secondPeriodEndDate)
      
      // For active collection points specifically, we count only those created in each period
      const getCollectionPointsForDate = (date: string) => {
        return collectionPointsData.filter(
          (cp) => cp.created_at && cp.created_at.startsWith(date)
        )
      }

      const getCollectionPointsForDateRange = (startDate: string, endDate: string) => {
        return collectionPointsData.filter(
          (cp) =>
            cp.created_at &&
            cp.created_at >= `${startDate}T00:00:00` &&
            cp.created_at <= `${endDate}T23:59:59`
        )
      }

      let firstPeriodCollectionPoints: any[] = []
      let secondPeriodCollectionPoints: any[] = []

      if (isComparingConsecutiveDays) {
        firstPeriodCollectionPoints = getCollectionPointsForDate(compareStartDate)
        secondPeriodCollectionPoints = getCollectionPointsForDate(compareEndDate)
      } else {
        const rangeStart = new Date(compareStartDate)
        const rangeEnd = new Date(compareEndDate)
        const midPoint = new Date(rangeStart.getTime() + (rangeEnd.getTime() - rangeStart.getTime()) / 2)
        const midDateStr = midPoint.toISOString().split("T")[0]

        firstPeriodCollectionPoints = getCollectionPointsForDateRange(compareStartDate, midDateStr)
        secondPeriodCollectionPoints = getCollectionPointsForDateRange(
          new Date(midPoint.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          compareEndDate
        )
      }

      const firstPeriodActiveCollectionPoints = firstPeriodCollectionPoints.filter((cp) => cp.status === "active").length
      const secondPeriodActiveCollectionPoints = secondPeriodCollectionPoints.filter((cp) => cp.status === "active").length
      const collectionPointsTrend = calculateTrend(secondPeriodActiveCollectionPoints, firstPeriodActiveCollectionPoints)

      // Calculate total collection points trend using cumulative counts
      const collectionPointsTotalTrendData = calculateTrend(secondPeriodCollectionPointsTotal.length, firstPeriodCollectionPointsTotal.length)
      setCollectionPointsTotalTrend(collectionPointsTotalTrendData)

      // Use overall active collection points for the KPI trend (not period-based)
      const collectionPointsActiveTrend = {
        trend: collectionPointsTotalTrendData.trend,
        isPositive: collectionPointsTotalTrendData.isPositive,
        hasZeroTrend: collectionPointsTotalTrendData.hasZeroTrend,
      }

      // Calculate total value for each period from deliveries
      const getDeliveryValueForDeliveries = (deliveries: any[]) => {
        return deliveries.reduce((sum, d) => {
          const amount = typeof d.estimated_value === 'string' ? parseFloat(d.estimated_value) || 0 : (typeof d.estimated_value === 'number' ? d.estimated_value : 0)
          return sum + amount
        }, 0)
      }

      // Calculate monthly values for all deliveries
      const monthlyValueMap: { [key: string]: number } = {}
      deliveriesData.forEach((delivery) => {
        if (delivery.created_at) {
          const date = new Date(delivery.created_at)
          const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' })
          const amount = typeof delivery.estimated_value === 'string' ? parseFloat(delivery.estimated_value) || 0 : (typeof delivery.estimated_value === 'number' ? delivery.estimated_value : 0)
          monthlyValueMap[monthKey] = (monthlyValueMap[monthKey] || 0) + amount
        }
      })

      // Generate all 12 months of the current year
      const currentYear = new Date().getFullYear()
      const allMonths = []
      for (let month = 0; month < 12; month++) {
        const date = new Date(currentYear, month, 1)
        const monthKey = date.toLocaleString('default', { month: 'short' })
        allMonths.push({
          month: monthKey,
          value: monthlyValueMap[`${monthKey} ${currentYear}`] || 0,
        })
      }

      const monthlyValues = allMonths

      const firstPeriodValue = getDeliveryValueForDeliveries(firstPeriodDeliveries)
      const secondPeriodValue = getDeliveryValueForDeliveries(secondPeriodDeliveries)
      setPeriodValues({
        firstPeriodValue,
        secondPeriodValue,
        monthlyValues,
      })

      // Calculate average delivery time in minutes from completed deliveries
      let avgDeliveryTime = "N/A"
      const completedDeliveries = deliveriesData.filter((d) => d.status === "completed")
      if (completedDeliveries.length > 0) {
        // Since we don't have completed_at timestamp, show number of completed deliveries as estimate
        avgDeliveryTime = `${completedDeliveries.length} deliveries`
      }

      // Calculate on-time rate 
      const onTimeRate = deliveriesData.length > 0 
        ? Math.round((completedCount / deliveriesData.length) * 100)
        : 0

      // Calculate total deliveries for the selected period
      const periodDeliveries = getDeliveriesForDateRange(compareStartDate, compareEndDate).length

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
        secondPeriodCollectionPointsLength: secondPeriodCollectionPointsTotal.length,
        secondPeriodActiveCollectionPoints: secondPeriodActiveCollectionPoints,
        secondPeriodActiveDrivers: secondPeriodActiveDrivers,
      })

      // Build KPIs array with dynamic data
      const kpisData: KPI[] = [
        {
          label: "Avg. Delivery Time",
          value: avgDeliveryTime,
          icon: Timer,
          trend: deliveryTimeTrend.trend,
          trendIsPositive: deliveryTimeTrend.isPositive,
          hasZeroTrend: deliveryTimeTrend.hasZeroTrend,
        },
        {
          label: "On-Time Rate",
          value: `${secondPeriodOnTime}%`,
          icon: TrendingUp,
          trend: onTimeTrend.trend,
          trendIsPositive: onTimeTrend.isPositive,
          hasZeroTrend: onTimeTrend.hasZeroTrend,
        },
        {
          label: "Period Deliveries",
          value: secondPeriodDeliveries.length.toString(),
          icon: Package,
          trend: deliveryTimeTrend.trend,
          trendIsPositive: deliveryTimeTrend.isPositive,
          hasZeroTrend: deliveryTimeTrend.hasZeroTrend,
        },
        {
          label: "Active Drivers",
          value: secondPeriodActiveDrivers.toString(),
          icon: Truck,
          trend: driversTrend.trend,
          trendIsPositive: driversTrend.isPositive,
          hasZeroTrend: driversTrend.hasZeroTrend,
        },
        {
          label: "Avg. Route Length",
          value: `${secondPeriodAvgRoute} stops`,
          icon: MapPin,
          trend: routeTrend.trend,
          trendIsPositive: routeTrend.isPositive,
          hasZeroTrend: routeTrend.hasZeroTrend,
        },
        {
          label: "Active Collection Points",
          value: secondPeriodActiveCollectionPoints.toString(),
          icon: Warehouse,
          trend: collectionPointsTrend.trend,
          trendIsPositive: collectionPointsTrend.isPositive,
          hasZeroTrend: collectionPointsTrend.hasZeroTrend,
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
    if (isInitialized && compareStartDate && compareEndDate) {
      fetchAnalyticsData()
    }
  }, [compareStartDate, compareEndDate, isInitialized])

  return (
    <div className="p-6 bg-[#EFF0EB] space-y-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Track your delivery performance and insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isInitialized && (
            <>
              <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    {compareStartDate} to {compareEndDate}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Comparison Date Range</DialogTitle>
                    <DialogDescription>
                      Choose two dates to compare trends. The data will be split in half between these dates.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={compareStartDate}
                        onChange={(e) => setCompareStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={compareEndDate}
                        onChange={(e) => setCompareEndDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCompareStartDate(getYesterdayDate())
                          setCompareEndDate(getTodayDate())
                        }}
                        className="flex-1"
                      >
                        Today vs Yesterday
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const weekAgo = new Date()
                          weekAgo.setDate(weekAgo.getDate() - 7)
                          setCompareStartDate(weekAgo.toISOString().split("T")[0])
                          setCompareEndDate(getTodayDate())
                        }}
                        className="flex-1"
                      >
                        Last 7 Days
                      </Button>
                    </div>
                    <Button
                      onClick={() => setIsDateDialogOpen(false)}
                      className="w-full bg-[#C8E298] text-black"
                    >
                      Apply
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                onClick={fetchAnalyticsData}
                disabled={isLoading}
                variant="outline"
                className="text-sm"
              >
                {isLoading ? "Refreshing..." : "Refresh Data"}
              </Button>
            </>
          )}
        </div>
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
          {/* Deliveries Analytics */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Deliveries Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Deliveries</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDeliveries}</p>
                    </div>
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-green-50 text-green-700">{stats.completedDeliveries} completed</span>
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">{stats.inTransitDeliveries} in transit</span>
                    </div>
                    {kpis[0]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[0]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[0]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[0]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[0]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">On-Time Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.completedDeliveries > 0 ? Math.round((stats.completedDeliveries / stats.totalDeliveries) * 100) : 0}%</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Delivery success rate</p>
                    {kpis[1]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[1]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[1]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[1]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[1]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Value</p>
                      <p className="text-2xl font-bold text-gray-900">KSh {(stats.totalValue / 1000).toFixed(0)}K</p>
                    </div>
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Total delivery value</p>
                    {kpis[2]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[2]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[2]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[2]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[2]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Avg. Delivery Time</p>
                      <p className="text-2xl font-bold text-gray-900">32 min</p>
                    </div>
                    <Timer className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Average delivery duration</p>
                    {kpis[0]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[0]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[0]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[0]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[0]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Routes Analytics */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Routes Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Routes</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRoutes}</p>
                    </div>
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeRoutes} active
                    </Badge>
                    {kpis[4]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[4]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[4]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[4]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[4]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Avg. Route Length</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRoutes > 0 ? Math.round(stats.totalDeliveries / stats.totalRoutes) : 0} stops</p>
                    </div>
                    <Truck className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Stops per route</p>
                    {kpis[4]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[4]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[4]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[4]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[4]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Route Efficiency</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeRoutes > 0 ? Math.round((stats.completedDeliveries / stats.totalDeliveries) * 100) : 0}%</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Completion rate</p>
                    {kpis[1]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[1]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[1]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[1]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[1]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Drivers Analytics */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Drivers Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Drivers</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDrivers}</p>
                    </div>
                    <Truck className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeDrivers} active
                    </Badge>
                    {kpis[3]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[3]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[3]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[3]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[3]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Active Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDrivers > 0 ? Math.round((stats.activeDrivers / stats.totalDrivers) * 100) : 0}%</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Active drivers ratio</p>
                    {kpis[3]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[3]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[3]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[3]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[3]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Deliveries per Driver</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeDrivers > 0 ? Math.round(stats.totalDeliveries / stats.activeDrivers) : 0}</p>
                    </div>
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Average per active driver</p>
                    {kpis[3]?.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{kpis[3]?.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${kpis[3]?.trendIsPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!kpis[3]?.trendIsPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{kpis[3]?.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Collection Points Analytics */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Collection Points Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Points</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalCollectionPoints}</p>
                    </div>
                    <Warehouse className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeCollectionPoints} active
                    </Badge>
                    {collectionPointsTotalTrend.hasZeroTrend ? (
                      <span className="font-medium text-xs text-gray-600">{collectionPointsTotalTrend.trend}</span>
                    ) : (
                      <div className={`flex items-center text-sm ${collectionPointsTotalTrend.isPositive ? "text-green-600" : "text-red-600"}`}>
                        <ArrowUpRight className={`h-4 w-4 mr-1 ${!collectionPointsTotalTrend.isPositive ? "rotate-180" : ""}`} />
                        <span className="font-medium text-xs">{collectionPointsTotalTrend.trend}</span>
                      </div>
                    )}
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

          {/* Statistical Charts Section */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Statistical Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Delivery Status Distribution Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Delivery Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Completed", value: stats.completedDeliveries, fill: "#10b981" },
                          { name: "In Transit", value: stats.inTransitDeliveries, fill: "#3b82f6" },
                          { name: "Pending", value: stats.pendingDeliveries, fill: "#f59e0b" },
                          { name: "Failed", value: stats.failedDeliveries, fill: "#ef4444" },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#3b82f6" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Collection Points by Type Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Collection Points by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Warehouses", value: stats.collectionPointsByType.warehouse, fill: "#6366f1" },
                          { name: "Depots", value: stats.collectionPointsByType.depot, fill: "#06b6d4" },
                          { name: "Hubs", value: stats.collectionPointsByType.hub, fill: "#8b5cf6" },
                          { name: "Pickup Points", value: stats.collectionPointsByType.pickup_point, fill: "#ec4899" },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#06b6d4" />
                        <Cell fill="#8b5cf6" />
                        <Cell fill="#ec4899" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Collection Points Status Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Collection Points Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Active", value: stats.activeCollectionPoints, fill: "#10b981" },
                          { name: "Inactive", value: stats.inactiveCollectionPoints, fill: "#9ca3af" },
                          { name: "Maintenance", value: stats.maintenanceCollectionPoints, fill: "#f59e0b" },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#9ca3af" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Driver Status Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Driver Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Active", value: stats.activeDrivers, fill: "#10b981" },
                          { name: "Inactive", value: stats.totalDrivers - stats.activeDrivers, fill: "#9ca3af" },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#9ca3af" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Route Status Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Route Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Active", value: stats.activeRoutes, fill: "#10b981" },
                          { name: "Pending", value: Math.max(stats.totalRoutes - stats.activeRoutes - stats.completedDeliveries, 0), fill: "#f59e0b" },
                          { name: "Completed", value: stats.completedDeliveries, fill: "#3b82f6" },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#10b981" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Total Value Bar Chart - Monthly */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Total Delivery Value by Month - {new Date().getFullYear()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={periodValues.monthlyValues.length > 0 ? periodValues.monthlyValues : [{ month: 'No data', value: 0 }]} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                        cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                        formatter={(value) => `KSh ${(value / 1000).toFixed(0)}K`}
                      />
                      <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Total Value" label={{ position: 'top', formatter: (value) => `KSh ${(value / 1000).toFixed(0)}K`, fill: '#374151' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
