"use client"

import { useEffect, useState, useMemo } from "react"
import { Package, Truck, MapPin, AlertCircle, Warehouse, Calendar, DollarSign, TrendingUp } from "lucide-react"
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
import { DeliveryService } from "@/lib/services/deliveries"
import { DriverService } from "@/lib/services/drivers"
import { RouteService } from "@/lib/services/routes"
import { CollectionPointService } from "@/lib/services/collection-points"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function AnalyticsScreen() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  
  // Date range state
  const formatAsLocalDate = (date: Date) => date.toLocaleDateString("en-CA")
  
  const getTodayDate = () => formatAsLocalDate(new Date())

  const [selectedPreset, setSelectedPreset] = useState("")

  const [compareStartDate, setCompareStartDate] = useState("")
  const [compareEndDate, setCompareEndDate] = useState("")
  
  // Initialize dates on client side only
  useEffect(() => {
    if (!isInitialized) {
      // Default to today only
      const today = getTodayDate()
      setCompareStartDate(today)
      setCompareEndDate(today)
      setIsInitialized(true)
    }
  }, [isInitialized])

  // Update selected preset when dates change
  useEffect(() => {
    if (!compareStartDate || !compareEndDate) {
      setSelectedPreset("")
      return
    }
    
    const today = getTodayDate()
    
    if (compareStartDate === today && compareEndDate === today) {
      setSelectedPreset("Today")
      return
    }
    
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    const weekAgoStr = formatAsLocalDate(weekAgo)
    if (compareStartDate === weekAgoStr && compareEndDate === today) {
      setSelectedPreset("Last 7 Days")
      return
    }
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const thirtyDaysAgoStr = formatAsLocalDate(thirtyDaysAgo)
    if (compareStartDate === thirtyDaysAgoStr && compareEndDate === today) {
      setSelectedPreset("Last 30 Days")
      return
    }
    
    setSelectedPreset("")
  }, [compareStartDate, compareEndDate])
  
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

  const [periodValues, setPeriodValues] = useState({
    firstPeriodValue: 0,
    secondPeriodValue: 0,
    monthlyValues: [] as Array<{ month: string; value: number }>,
    maxYAxis: 0,
  })

  const [chartTitle, setChartTitle] = useState("Total Delivery Value by Month")

  const fetchAnalyticsData = async () => {
    if (!compareStartDate || !compareEndDate) {
      return
    }

    if (new Date(compareStartDate) > new Date(compareEndDate)) {
      setValidationError("Start date cannot be after end date.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setValidationError(null)

      // Fetch deliveries data
      const deliveriesData = await DeliveryService.getAllDeliveries()

      // Fetch drivers data
      const driversData = await DriverService.getAllDrivers()

      // Fetch routes data
      const routesData = await RouteService.getAllRoutes()

      // Fetch collection points data
      const collectionPointsData = await CollectionPointService.getAllCollectionPoints()

      const startOfDayMs = (date: string) => new Date(`${date}T00:00:00`).getTime()
      const endOfDayMs = (date: string) => new Date(`${date}T23:59:59.999`).getTime()
      const isWithinRange = (timestamp: string | null, start: string, end: string) => {
        if (!timestamp) return false
        const created = new Date(timestamp).getTime()
        return created >= startOfDayMs(start) && created <= endOfDayMs(end)
      }

      const getCollectionPointTimestamp = (cp: any) => cp?.created_at ?? cp?.createdAt ?? null

      // Get deliveries for a date range (inclusive)
      const getDeliveriesForDateRange = (startDate: string, endDate: string) => {
        return deliveriesData.filter((d) => isWithinRange(d.created_at, startDate, endDate))
      }

      const getRoutesForDateRange = (startDate: string, endDate: string) => {
        return routesData.filter((route) => isWithinRange(route.created_at, startDate, endDate))
      }

      const getCollectionPointsForDateRange = (startDate: string, endDate: string) => {
        return collectionPointsData.filter((cp) => {
          const createdAt = getCollectionPointTimestamp(cp)
          return isWithinRange(createdAt, startDate, endDate)
        })
      }

      // Determine date range and split in half
      const getDayDiff = (start: string, end: string) => {
        const startDate = new Date(`${start}T00:00:00`)
        const endDate = new Date(`${end}T00:00:00`)
        const diffMs = endDate.getTime() - startDate.getTime()
        return Math.round(diffMs / (24 * 60 * 60 * 1000))
      }

      const hasRange = Boolean(compareStartDate && compareEndDate)

      let firstPeriodDeliveries: any[] = []
      let secondPeriodDeliveries: any[] = []

      if (hasRange) {
        // Fetch all deliveries for the selected range
        const rangeDeliveries = getDeliveriesForDateRange(compareStartDate, compareEndDate)
        firstPeriodDeliveries = rangeDeliveries
        secondPeriodDeliveries = rangeDeliveries
      }

      const routesInRange = hasRange && compareStartDate !== compareEndDate
        ? getRoutesForDateRange(compareStartDate, compareEndDate)
        : routesData

      // Calculate drivers based on date periods
      const getDriversForDateRange = (startDate: string, endDate: string) => {
        return driversData.filter((d) => isWithinRange(d.created_at, startDate, endDate))
      }

      let firstPeriodDrivers: any[] = []
      let secondPeriodDrivers: any[] = []

      if (hasRange) {
        // Fetch all drivers for the selected range
        const rangeDrivers = getDriversForDateRange(compareStartDate, compareEndDate)
        firstPeriodDrivers = rangeDrivers
        secondPeriodDrivers = rangeDrivers
      }

      const driversInRange = hasRange && compareStartDate !== compareEndDate
        ? getDriversForDateRange(compareStartDate, compareEndDate)
        : driversData

      const secondPeriodActiveDrivers = secondPeriodDrivers.filter((d) => d.status === "active").length

      // Get collection points for date period
      // For total collection points, we count all points that were created by the end of each period
      const getCollectionPointsCreatedByDate = (beforeDate: string) => {
        return collectionPointsData.filter((cp) => {
          const createdAt = getCollectionPointTimestamp(cp)
          return isWithinRange(createdAt, "1970-01-01", beforeDate)
        })
      }

      // Calculate end dates for each period
      const firstPeriodEndDate = compareStartDate
      const secondPeriodEndDate = compareEndDate

      const firstPeriodCollectionPointsTotal = getCollectionPointsCreatedByDate(firstPeriodEndDate)
      const secondPeriodCollectionPointsTotal = getCollectionPointsCreatedByDate(secondPeriodEndDate)
      
      let firstPeriodCollectionPoints: any[] = []
      let secondPeriodCollectionPoints: any[] = []

      if (hasRange) {
        // Fetch all collection points for the selected range
        const rangeCollectionPoints = getCollectionPointsForDateRange(compareStartDate, compareEndDate)
        firstPeriodCollectionPoints = rangeCollectionPoints
        secondPeriodCollectionPoints = rangeCollectionPoints
      }

      const collectionPointsInRange = hasRange && compareStartDate !== compareEndDate
        ? getCollectionPointsForDateRange(compareStartDate, compareEndDate)
        : collectionPointsData

      const firstPeriodActiveCollectionPoints = firstPeriodCollectionPoints.filter((cp) => cp.status === "active").length
      const secondPeriodActiveCollectionPoints = secondPeriodCollectionPoints.filter((cp) => cp.status === "active").length

      // Calculate total collection points using cumulative counts

      // Calculate total value for each period from deliveries
      const getDeliveryValueForDeliveries = (deliveries: any[]) => {
        return deliveries.reduce((sum, d) => {
          const amount = typeof d.estimated_value === "string" ? parseFloat(d.estimated_value) || 0 : (typeof d.estimated_value === "number" ? d.estimated_value : 0)
          return sum + amount
        }, 0)
      }

      // Deliveries in the selected comparison range
      // For date range selection, use filtered data; for today, use all data
      const periodDeliveries = hasRange && compareStartDate !== compareEndDate
        ? getDeliveriesForDateRange(compareStartDate, compareEndDate)
        : deliveriesData

      // Calculate monthly values for deliveries within the effective range
      const monthlyValueMap: { [key: string]: number } = {}
      periodDeliveries.forEach((delivery) => {
        if (delivery.created_at) {
          const date = new Date(delivery.created_at)
          const monthLabel = date.toLocaleString("default", { month: "short" })
          const year = date.getFullYear()
          const key = `${monthLabel} ${year}`
          const amount =
            typeof delivery.estimated_value === "string"
              ? parseFloat(delivery.estimated_value) || 0
              : typeof delivery.estimated_value === "number"
              ? delivery.estimated_value
              : 0
          monthlyValueMap[key] = (monthlyValueMap[key] || 0) + amount
        }
      })

      // Create a map of all 12 months in order
      const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      
      // Only include months that actually have value; chart falls back to "No data" when empty
      const monthlyValuesMap = Object.entries(monthlyValueMap)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => {
          const [month] = key.split(" ")
          return { month, value }
        })

      // Create data for all 12 months, filling in 0 for months with no data
      const monthlyValues = monthOrder.map((month) => {
        const found = monthlyValuesMap.find((m) => m.month === month)
        return {
          month,
          value: found ? found.value : 0,
        }
      })

      // Calculate max value for Y-axis scaling
      const maxValue = Math.max(...monthlyValues.map((m) => m.value), 1)
      // Round up to the nearest reasonable increment (10, 100, 1000, 10000, etc.)
      const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(maxValue)))
      const roundedMax = Math.ceil(maxValue / orderOfMagnitude) * orderOfMagnitude

      // Extract unique years from the data and generate dynamic title
      const yearsInData = Array.from(
        new Set(
          Object.entries(monthlyValueMap)
            .filter(([, value]) => value > 0)
            .map(([key]) => key.split(" ")[1])
        )
      ).sort()

      const dynamicChartTitle = yearsInData.length > 0
        ? `Total Delivery Value by Month - ${yearsInData.join(", ")}`
        : "Total Delivery Value by Month"
      setChartTitle(dynamicChartTitle)

      const firstPeriodValue = getDeliveryValueForDeliveries(firstPeriodDeliveries)
      const secondPeriodValue = getDeliveryValueForDeliveries(secondPeriodDeliveries)
      setPeriodValues({
        firstPeriodValue,
        secondPeriodValue,
        monthlyValues,
        maxYAxis: roundedMax,
      })

      const completedCountPeriod = periodDeliveries.filter((d) => d.status === "completed").length

      // Calculate average delivery time estimate for the comparison period
      let avgDeliveryTime = "N/A"
      if (completedCountPeriod > 0) {
        // Since we don't have completed_at timestamp, show number of completed deliveries as estimate
        avgDeliveryTime = `${completedCountPeriod} deliveries`
      }

      // Calculate average route length within the comparison range
      const avgRouteLength = routesInRange.length > 0
        ? Math.round(periodDeliveries.length / routesInRange.length)
        : 0

      const deliveryValueForRange = getDeliveryValueForDeliveries(periodDeliveries)
      const driversInRangeActive = driversInRange.filter((d) => d.status === "active")
      const routesInRangeActive = routesInRange.filter((r) => r.status === "active")

      // Stats based on the effective range (full DB when no date selected, or filtered by created_at when range is set)
      const completedCount = periodDeliveries.filter((d) => d.status === "completed").length
      const inTransitCount = periodDeliveries.filter((d) => d.status === "in-progress").length
      const pendingCount = periodDeliveries.filter((d) => d.status === "pending").length
      const failedCount = periodDeliveries.filter((d) => d.status === "failed").length
      const totalValue = getDeliveryValueForDeliveries(periodDeliveries)

      const activeDrivers = driversInRangeActive.length
      const totalDrivers = driversInRange.length

      const totalRoutes = routesInRange.length
      const activeRoutes = routesInRangeActive.length

      const collectionPointsByType = {
        warehouse: collectionPointsInRange.filter((cp) => cp.type === "warehouse").length,
        depot: collectionPointsInRange.filter((cp) => cp.type === "depot").length,
        hub: collectionPointsInRange.filter((cp) => cp.type === "hub").length,
        pickup_point: collectionPointsInRange.filter((cp) => cp.type === "pickup_point").length,
      }

      const activeCollectionPoints = collectionPointsInRange.filter((cp) => cp.status === "active").length
      const inactiveCollectionPoints = collectionPointsInRange.filter((cp) => cp.status === "inactive").length
      const maintenanceCollectionPoints = collectionPointsInRange.filter((cp) => cp.status === "maintenance").length

      const totalVehiclesAtPoints = collectionPointsInRange.reduce(
        (sum, cp) => sum + (cp.assignmentVehicles || 0),
        0
      )

      // Update stats state
      setStats({
        totalDeliveries: periodDeliveries.length,
        completedDeliveries: completedCount,
        inTransitDeliveries: inTransitCount,
        pendingDeliveries: pendingCount,
        failedDeliveries: failedCount,
        totalValue,
        activeDrivers,
        totalDrivers,
        totalRoutes,
        activeRoutes,
        totalCollectionPoints: collectionPointsInRange.length,
        activeCollectionPoints,
        inactiveCollectionPoints,
        maintenanceCollectionPoints,
        collectionPointsByType,
        totalVehiclesAtPoints,
        secondPeriodCollectionPointsLength: secondPeriodCollectionPointsTotal.length,
        secondPeriodActiveCollectionPoints: secondPeriodActiveCollectionPoints,
        secondPeriodActiveDrivers: secondPeriodActiveDrivers,
      })


    } catch (err) {
      console.error("Error fetching analytics data:", err)
      setError("Failed to load analytics data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isInitialized || !compareStartDate || !compareEndDate) {
      return
    }

    if (new Date(compareStartDate) > new Date(compareEndDate)) {
      setValidationError("Start date cannot be after end date.")
      setIsLoading(false)
      return
    }

    setValidationError(null)
    fetchAnalyticsData()
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
                    {selectedPreset || `${compareStartDate} to ${compareEndDate}`}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Comparison Date Range</DialogTitle>
                    <DialogDescription>
                      {selectedPreset ? `Selected: ${selectedPreset}` : "Choose two dates to compare analytics data."}
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
                        variant={selectedPreset === "Today" ? "default" : "outline"}
                        onClick={() => {
                          const today = getTodayDate()
                          setCompareStartDate(today)
                          setCompareEndDate(today)
                        }}
                        className={`flex-1 ${selectedPreset === "Today" ? "bg-[#C8E298] text-black hover:bg-[#B8D289]" : ""}`}
                      >
                        Today
                      </Button>
                      <Button
                        variant={selectedPreset === "Last 7 Days" ? "default" : "outline"}
                        onClick={() => {
                          const weekAgo = new Date()
                          weekAgo.setDate(weekAgo.getDate() - 6)
                          setCompareStartDate(formatAsLocalDate(weekAgo))
                          setCompareEndDate(getTodayDate())
                        }}
                        className={`flex-1 ${selectedPreset === "Last 7 Days" ? "bg-[#C8E298] text-black hover:bg-[#B8D289]" : ""}`}
                      >
                        Last 7 Days
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedPreset === "Last 30 Days" ? "default" : "outline"}
                        onClick={() => {
                          const today = new Date()
                          const thirtyDaysAgo = new Date()
                          thirtyDaysAgo.setDate(today.getDate() - 29)
                          setCompareStartDate(formatAsLocalDate(thirtyDaysAgo))
                          setCompareEndDate(getTodayDate())
                        }}
                        className={`flex-1 ${selectedPreset === "Last 30 Days" ? "bg-[#C8E298] text-black hover:bg-[#B8D289]" : ""}`}
                      >
                        Last 30 Days
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
                disabled={isLoading || Boolean(validationError)}
                variant="outline"
                className="text-sm"
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Validation State */}
      {validationError && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-700" />
          <p className="text-sm text-yellow-700">{validationError}</p>
        </div>
      )}

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
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDeliveries || 0}</p>
                    </div>
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  {stats.totalDeliveries > 0 ? (
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-green-50 text-green-700">{stats.completedDeliveries} completed</span>
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">{stats.inTransitDeliveries} in transit</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
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
                  {stats.totalDeliveries > 0 ? (
                    <p className="text-xs text-gray-500">Delivery success rate</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Value</p>
                      <p className="text-2xl font-bold text-gray-900">KSh {(stats.totalValue || 0).toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  {stats.totalValue > 0 ? (
                    <p className="text-xs text-gray-500">Total delivery value</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Pending Deliveries</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.pendingDeliveries || 0}</p>
                    </div>
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                  {stats.totalDeliveries > 0 ? (
                    <p className="text-xs text-gray-500">Awaiting delivery</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
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
                      <p className="text-2xl font-bold text-gray-900">{stats.totalRoutes || 0}</p>
                    </div>
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  {stats.totalRoutes > 0 ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeRoutes} active
                    </Badge>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
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
                      <p className="text-2xl font-bold text-gray-900">{stats.totalDrivers || 0}</p>
                    </div>
                    <Truck className="h-6 w-6 text-blue-600" />
                  </div>
                  {stats.totalDrivers > 0 ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeDrivers} active
                    </Badge>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
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
                      <p className="text-2xl font-bold text-gray-900">{stats.totalCollectionPoints || 0}</p>
                    </div>
                    <Warehouse className="h-6 w-6 text-blue-600" />
                  </div>
                  {stats.totalCollectionPoints > 0 ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {stats.activeCollectionPoints} active
                    </Badge>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data to show</p>
                  )}
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
                  {stats.totalDeliveries > 0 ? (
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
                          label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400 italic">No data to show</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Collection Points by Type Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Collection Points by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.totalCollectionPoints > 0 ? (
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
                          label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400 italic">No data to show</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Collection Points Status Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Collection Points Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.totalCollectionPoints > 0 ? (
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
                          label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400 italic">No data to show</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Driver Status Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Driver Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.totalDrivers > 0 ? (
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
                          label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400 italic">No data to show</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Route Status Pie Chart */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">Route Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.totalRoutes > 0 ? (
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
                          label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400 italic">No data to show</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Total Value Bar Chart - Monthly */}
              <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900">{chartTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  {periodValues.monthlyValues.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={periodValues.monthlyValues} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" domain={[0, periodValues.maxYAxis]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                          cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                          formatter={(value) => {
                            const numericValue = Number(value) || 0
                            return `KSh ${(numericValue.toLocaleString())}`
                          }}
                        />
                        <Bar
                          dataKey="value"
                          fill="#06b6d4"
                          radius={[8, 8, 0, 0]}
                          name="Total Value"
                          label={{
                            position: "top",
                            formatter: (value) => {
                              const numericValue = Number(value) || 0
                              return `KSh ${(numericValue.toLocaleString())}`
                            },
                            fill: "#374151",
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400 italic">No data to show</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
