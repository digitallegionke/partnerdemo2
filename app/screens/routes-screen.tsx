"use client"

import { useState, useEffect } from "react"
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
  AlertCircle 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RouteService, type RouteWithDriver } from "@/lib/services/routes"
import { DriverService } from "@/lib/services/drivers"
import { DeliveryService } from "@/lib/services/deliveries"
import { useToast } from "@/hooks/use-toast"
import AddressSearch from "@/components/address-search"

// Transform Supabase route data to UI format
const transformRouteForUI = async (route: RouteWithDriver) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatDistance = (distance: number) => {
    return `${distance.toFixed(1)} km`
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  // Get delivery count for this route
  let deliveryCount = 0
  try {
    const deliveries = await DeliveryService.getDeliveriesByRoute(route.id)
    deliveryCount = deliveries.length
  } catch (error) {
    console.error('Error getting deliveries for route:', route.id, error)
    // Don't throw, just use 0 as default
  }
  
  return {
    id: route.id,
    name: route.name,
    distance: route.total_distance ? formatDistance(route.total_distance) : '0.0 km',
    duration: route.estimated_duration ? formatDuration(route.estimated_duration) : '0m',
    stops: deliveryCount,
    status: route.status,
    driver: route.driver?.name || 'Unassigned',
    lastUpdated: getTimeAgo(route.updated_at),
    efficiency: route.efficiency_score || 0,
    // Keep raw data for other operations
    raw: route
  }
}

interface RoutesScreenProps {
  onViewRouteMap: (route: any, deliveries: any[]) => void
}

export default function RoutesScreen({ onViewRouteMap }: RoutesScreenProps) {
  const [routes, setRoutes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    start_location: "",
    start_latitude: "",
    start_longitude: "",
    end_location: "",
    end_latitude: "",
    end_longitude: "",
    driver_id: "unassigned"
  })
  const [drivers, setDrivers] = useState<any[]>([])
  const { toast } = useToast()

  // Load routes from Supabase
  const loadRoutes = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Get all routes with driver information
      const routesData = await RouteService.getAllRoutes()
      
      if (routesData.length === 0) {
        setRoutes([])
        return
      }
      
      // Transform routes for UI display with better error handling
      const transformPromises = routesData.map(async (route) => {
        try {
          return await transformRouteForUI(route)
        } catch (error) {
          console.error(`Error transforming route ${route.id}:`, error)
          // Return basic route data if transformation fails
          return {
            id: route.id,
            name: route.name,
            distance: route.total_distance ? `${route.total_distance.toFixed(1)} km` : '0.0 km',
            duration: route.estimated_duration ? 
              `${Math.floor(route.estimated_duration / 60)}h ${route.estimated_duration % 60}m` : 
              '0m',
            stops: 0,
            status: route.status,
            driver: route.driver?.name || 'Unassigned',
            lastUpdated: new Date(route.updated_at).toLocaleDateString(),
            efficiency: route.efficiency_score || 0,
            raw: route
          }
        }
      })
      
      const transformedRoutes = await Promise.all(transformPromises)
      setRoutes(transformedRoutes)
    } catch (err) {
      console.error('Error loading routes:', err)
      setError('Failed to load routes. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Load drivers for the form dropdown
  const loadDrivers = async () => {
    try {
      const driversData = await DriverService.getAllDrivers()
      setDrivers(driversData)
    } catch (error) {
      console.error('Error loading drivers:', error)
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadRoutes()
    loadDrivers()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      start_location: "",
      start_latitude: "",
      start_longitude: "",
      end_location: "",
      end_latitude: "",
      end_longitude: "",
      driver_id: "unassigned"
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate that locations have been selected with coordinates
      if (!formData.start_latitude || !formData.start_longitude) {
        toast({
          title: "Error",
          description: "Please select a valid start location with coordinates.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      if (!formData.end_latitude || !formData.end_longitude) {
        toast({
          title: "Error",
          description: "Please select a valid end location with coordinates.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const routeData = {
        name: formData.name,
        start_location: formData.start_location,
        end_location: formData.end_location,
        driver_id: formData.driver_id !== "unassigned" ? parseInt(formData.driver_id) : null,
        status: 'pending' as const,
      }

      await RouteService.createRoute(routeData)
      
      // Reset form and close dialog
      resetForm()
      setIsAddDialogOpen(false)
      
      // Refresh routes list
      await loadRoutes()
      
      toast({
        title: "Success",
        description: "Route created successfully!",
      })
      
    } catch (error) {
      console.error('Error creating route:', error)
      toast({
        title: "Error",
        description: "Failed to create route. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch = route.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === "all" || route.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  const handleViewMap = async (route: any) => {
    try {
      // Use the raw route data if available, otherwise find by ID
      const routeData = route.raw || route
      
      const deliveries = await DeliveryService.getDeliveriesByRoute(routeData.id)
      onViewRouteMap(routeData, deliveries)
    } catch (error) {
      console.error('Error loading route deliveries:', error)
      toast({
        title: "Error",
        description: "Failed to load route deliveries. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditRoute = (route: any) => {
    const routeData = route.raw || route
    setEditingRoute(routeData)
    
    // Pre-populate form with route data
    setFormData({
      name: routeData.name || "",
      start_location: routeData.start_location || "",
      start_latitude: "",
      start_longitude: "",
      end_location: routeData.end_location || "",
      end_latitude: "",
      end_longitude: "",
      driver_id: routeData.driver_id ? routeData.driver_id.toString() : "unassigned"
    })
    
    setIsEditDialogOpen(true)
  }

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoute) return

    setIsSubmitting(true)

    try {
      const updateData: any = {
        name: formData.name,
        start_location: formData.start_location,
        end_location: formData.end_location,
        driver_id: formData.driver_id !== "unassigned" ? parseInt(formData.driver_id) : null,
      }

      await RouteService.updateRoute(editingRoute.id, updateData)
      
      // Reset form and close dialog
      resetForm()
      setIsEditDialogOpen(false)
      setEditingRoute(null)
      
      // Refresh routes list
      await loadRoutes()
      
      toast({
        title: "Success",
        description: "Route updated successfully!",
      })
      
    } catch (error) {
      console.error('Error updating route:', error)
      toast({
        title: "Error",
        description: "Failed to update route. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 bg-white">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search routes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 bg-white border-gray-300"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-white border-gray-300">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline" 
            onClick={loadRoutes}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Route
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-gray-200 max-w-md overflow-visible">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Add New Route</DialogTitle>
                <DialogDescription>
                  Create a new route with start and end locations, and optionally assign a driver.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 overflow-visible">
                <div>
                  <Label htmlFor="routeName" className="text-gray-700">
                    Route Name *
                  </Label>
                  <Input
                    id="routeName"
                    placeholder="Enter route name"
                    className="bg-white border-gray-300"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="startLocation" className="text-gray-700">
                    Start Location *
                  </Label>
                  <AddressSearch
                    value={formData.start_location}
                    onSelect={(result) => {
                      handleInputChange("start_location", result.display_name);
                      handleInputChange("start_latitude", result.coordinates[0].toString());
                      handleInputChange("start_longitude", result.coordinates[1].toString());
                    }}
                    placeholder="Search for starting point"
                    className="mt-1"
                    countryCode="ke"
                  />
                  {formData.start_latitude && formData.start_longitude && (
                    <p className="text-xs text-gray-500 mt-1">
                      Coordinates: {parseFloat(formData.start_latitude).toFixed(4)}, {parseFloat(formData.start_longitude).toFixed(4)}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="endLocation" className="text-gray-700">
                    End Location *
                  </Label>
                  <AddressSearch
                    value={formData.end_location}
                    onSelect={(result) => {
                      handleInputChange("end_location", result.display_name);
                      handleInputChange("end_latitude", result.coordinates[0].toString());
                      handleInputChange("end_longitude", result.coordinates[1].toString());
                    }}
                    placeholder="Search for ending point"
                    className="mt-1"
                    countryCode="ke"
                  />
                  {formData.end_latitude && formData.end_longitude && (
                    <p className="text-xs text-gray-500 mt-1">
                      Coordinates: {parseFloat(formData.end_latitude).toFixed(4)}, {parseFloat(formData.end_longitude).toFixed(4)}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="driver" className="text-gray-700">
                    Assign Driver (Optional)
                  </Label>
                  <Select value={formData.driver_id} onValueChange={(value) => handleInputChange("driver_id", value)}>
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id.toString()}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setIsAddDialogOpen(false)
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSubmitting ? "Creating..." : "Create Route"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading routes...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading routes</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button 
            onClick={loadRoutes}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Routes Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoutes.map((route) => (
            <Card key={route.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-900">{route.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(route.status)}>{route.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
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
                      <span className="text-gray-900">{route.stops} stop{route.stops !== 1 ? 's' : ''}</span>
                    </div>
                    {route.efficiency > 0 && (
                      <span className="text-green-600 font-medium">{route.efficiency}% efficient</span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Driver:</span>
                      <span className="text-gray-900 font-medium">{route.driver}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500">Updated:</span>
                      <span className="text-gray-600">{route.lastUpdated}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                      onClick={() => handleViewMap(route)}
                    >
                      <Map className="h-4 w-4 mr-2" />
                      View Map
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
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Route
          </Button>
        </div>
      )}
    </div>
  )
}
