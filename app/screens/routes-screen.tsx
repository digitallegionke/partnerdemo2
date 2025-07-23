"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, MapPin, Clock, Truck, MoreVertical, Download, Search, Map, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RouteService, type RouteWithDriver } from "@/lib/services/routes"
import { DeliveryService } from "@/lib/services/deliveries"
import { useToast } from "@/hooks/use-toast"

const mockRoutes = [
  {
    id: 1,
    name: "Nairobi Central Route",
    distance: "45.2 km",
    duration: "2h 30m",
    stops: 8,
    status: "active",
    driver: "James Ochieng",
    lastUpdated: "2 hours ago",
    efficiency: 92,
  },
  {
    id: 2,
    name: "Westlands Circuit",
    distance: "32.8 km",
    duration: "1h 45m",
    stops: 6,
    status: "completed",
    driver: "Sarah Muthoni",
    lastUpdated: "4 hours ago",
    efficiency: 88,
  },
  {
    id: 3,
    name: "Eastlands Express",
    distance: "28.5 km",
    duration: "1h 20m",
    stops: 5,
    status: "pending",
    driver: "Unassigned",
    lastUpdated: "1 day ago",
    efficiency: 0,
  },
  {
    id: 4,
    name: "Karen-Langata Loop",
    distance: "38.7 km",
    duration: "2h 10m",
    stops: 7,
    status: "active",
    driver: "David Kiprop",
    lastUpdated: "30 minutes ago",
    efficiency: 95,
  },
]

// Sample delivery data for each route
const mockDeliveries = {
  1: [ // Nairobi Central Route
    { id: 1, farmerName: "John Kamau", location: "CBD Market", coordinates: [-1.2864, 36.8172] as [number, number], produce: "Tomatoes", dropTime: "09:00 AM", status: "completed", phone: "+254712345678" },
    { id: 2, farmerName: "Mary Wanjiku", location: "City Hall", coordinates: [-1.2921, 36.8219] as [number, number], produce: "Carrots", dropTime: "09:30 AM", status: "completed", phone: "+254723456789" },
    { id: 3, farmerName: "Peter Mutua", location: "Railway Station", coordinates: [-1.3067, 36.8321] as [number, number], produce: "Potatoes", dropTime: "10:00 AM", status: "in-progress", phone: "+254734567890" },
    { id: 4, farmerName: "Grace Akinyi", location: "Central Park", coordinates: [-1.2884, 36.8233] as [number, number], produce: "Onions", dropTime: "10:30 AM", status: "pending", phone: "+254745678901" },
  ],
  2: [ // Westlands Circuit
    { id: 5, farmerName: "Samuel Kiprotich", location: "Westlands Mall", coordinates: [-1.2676, 36.8099] as [number, number], produce: "Spinach", dropTime: "08:00 AM", status: "completed", phone: "+254756789012" },
    { id: 6, farmerName: "Ruth Njeri", location: "Sarit Centre", coordinates: [-1.2689, 36.8076] as [number, number], produce: "Kales", dropTime: "08:45 AM", status: "completed", phone: "+254767890123" },
    { id: 7, farmerName: "Joseph Mwangi", location: "ABC Place", coordinates: [-1.2643, 36.8123] as [number, number], produce: "Cabbages", dropTime: "09:30 AM", status: "completed", phone: "+254778901234" },
  ],
  3: [ // Eastlands Express
    { id: 8, farmerName: "Agnes Wambui", location: "Eastleigh Market", coordinates: [-1.2741, 36.8441] as [number, number], produce: "Bananas", dropTime: "07:30 AM", status: "pending", phone: "+254789012345" },
    { id: 9, farmerName: "David Omondi", location: "Donholm Shopping", coordinates: [-1.2945, 36.8876] as [number, number], produce: "Maize", dropTime: "08:15 AM", status: "pending", phone: "+254790123456" },
    { id: 10, farmerName: "Helen Chebet", location: "Umoja Market", coordinates: [-1.2834, 36.8765] as [number, number], produce: "Beans", dropTime: "09:00 AM", status: "pending", phone: "+254701234567" },
  ],
  4: [ // Karen-Langata Loop
    { id: 11, farmerName: "Michael Wekesa", location: "Karen Shopping", coordinates: [-1.3197, 36.7085] as [number, number], produce: "Avocados", dropTime: "10:00 AM", status: "in-progress", phone: "+254712345679" },
    { id: 12, farmerName: "Susan Moraa", location: "Junction Mall", coordinates: [-1.3037, 36.7324] as [number, number], produce: "Mangoes", dropTime: "10:45 AM", status: "completed", phone: "+254723456780" },
    { id: 13, farmerName: "Francis Kiplagat", location: "Langata Link", coordinates: [-1.3654, 36.7208] as [number, number], produce: "Oranges", dropTime: "11:30 AM", status: "pending", phone: "+254734567891" },
  ],
}

interface RoutesScreenProps {
  onViewRouteMap: (route: any, deliveries: any[]) => void
}

export default function RoutesScreen({ onViewRouteMap }: RoutesScreenProps) {
  const [routes, setRoutes] = useState<RouteWithDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { toast } = useToast()

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
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  // Load routes from Supabase
  useEffect(() => {
    loadRoutes()
  }, [])

  const loadRoutes = async () => {
    try {
      setLoading(true)
      // Temporarily use simple method without joins
      const simpleData = await RouteService.getAllRoutesSimple()
      
      // Transform to match expected interface
      const data = simpleData.map(route => ({
        ...route,
        driver: null // We'll add driver info later
      }))
      
      setRoutes(data)
    } catch (error) {
      console.error('Error loading routes:', error)
      toast({
        title: "Error",
        description: "Failed to load routes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewMap = async (route: RouteWithDriver) => {
    try {
      const deliveries = await DeliveryService.getDeliveriesByRoute(route.id)
      
      // Transform route to expected format
      const transformedRoute = {
        id: route.id,
        name: route.name,
        distance: route.total_distance ? `${route.total_distance.toFixed(1)} km` : '0 km',
        duration: route.estimated_duration ? `${Math.floor(route.estimated_duration / 60)}h ${route.estimated_duration % 60}m` : '0h 0m',
        stops: deliveries.length,
        status: route.status,
        driver: route.driver?.name || 'Unassigned',
        lastUpdated: new Date(route.updated_at).toLocaleString(),
        efficiency: route.efficiency_score || 0
      }
      
      onViewRouteMap(transformedRoute, deliveries)
    } catch (error) {
      console.error('Error loading route deliveries:', error)
      toast({
        title: "Error",
        description: "Failed to load route deliveries. Please try again.",
        variant: "destructive",
      })
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
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Route
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-gray-200">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Add New Route</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="routeName" className="text-gray-700">
                    Route Name
                  </Label>
                  <Input id="routeName" placeholder="Enter route name" className="bg-white border-gray-300" />
                </div>
                <div>
                  <Label htmlFor="description" className="text-gray-700">
                    Description
                  </Label>
                  <Textarea id="description" placeholder="Route description" className="bg-white border-gray-300" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startPoint" className="text-gray-700">
                      Start Point
                    </Label>
                    <Input id="startPoint" placeholder="Starting location" className="bg-white border-gray-300" />
                  </div>
                  <div>
                    <Label htmlFor="endPoint" className="text-gray-700">
                      End Point
                    </Label>
                    <Input id="endPoint" placeholder="Ending location" className="bg-white border-gray-300" />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                  >
                    Cancel
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">Create Route</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Routes Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading routes...</span>
        </div>
      ) : (
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
                      <span className="text-gray-900">
                        {route.total_distance ? `${route.total_distance.toFixed(1)} km` : '0 km'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-gray-900">
                        {route.estimated_duration 
                          ? `${Math.floor(route.estimated_duration / 60)}h ${route.estimated_duration % 60}m` 
                          : '0h 0m'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <Truck className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-gray-900">Loading stops...</span>
                    </div>
                    {route.efficiency_score && route.efficiency_score > 0 && (
                      <span className="text-green-600 font-medium">{route.efficiency_score}% efficient</span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Driver:</span>
                      <span className="text-gray-900 font-medium">
                        {route.driver?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500">Updated:</span>
                      <span className="text-gray-600">
                        {new Date(route.updated_at).toLocaleDateString()}
                      </span>
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
      {filteredRoutes.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create First Route
          </Button>
        </div>
      )}
    </div>
  )
}
