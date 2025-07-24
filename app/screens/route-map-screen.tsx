"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Clock, Users, Package, CheckCircle, AlertCircle, Settings, Zap, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, MapPin, Filter } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import MapComponent from "@/app/components/map-component"
import { optimizeRoute, formatDistance, formatDuration, formatCost } from "@/lib/route-optimization"

type DeliveryData = {
  id: number
  customer_name: string
  location: string
  coordinates: [number, number] // [lat, lng]  
  item: string
  estimated_value?: string | null
  weight?: string | null
  phone: string
  drop_time: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
}

interface Route {
  id: number
  name: string
  distance: string
  duration: string
  stops: number
  status: string
  driver: string | { id: number; name: string; phone: string; vehicle_type: string } | null
  lastUpdated: string
  efficiency: number
}

interface RouteMapScreenProps {
  route: Route
  deliveries: DeliveryData[]
  onBack: () => void
}

export default function RouteMapScreen({ route, deliveries, onBack }: RouteMapScreenProps) {
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryData | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isOptimizeDialogOpen, setIsOptimizeDialogOpen] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<any>(null)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'nearest-neighbor' | 'genetic' | '2-opt' | 'simulated-annealing'>('nearest-neighbor')
  const [optimizedDeliveries, setOptimizedDeliveries] = useState<DeliveryData[]>(deliveries)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Helper function to get driver name safely
  const getDriverName = (driver: Route['driver']): string => {
    if (!driver) return 'Unassigned'
    if (typeof driver === 'string') return driver
    if (typeof driver === 'object' && driver.name) return driver.name
    return 'Unassigned'
  }

  // Update optimized deliveries when deliveries prop changes
  useEffect(() => {
    setOptimizedDeliveries(deliveries)
    setOptimizationResult(null)
  }, [deliveries])

  // Calculate stats
  const totalDeliveries = optimizedDeliveries.length
  const completedDeliveries = optimizedDeliveries.filter(d => d.status === "completed").length
  const inProgressDeliveries = optimizedDeliveries.filter(d => d.status === "in-progress").length
  const pendingDeliveries = optimizedDeliveries.filter(d => d.status === "pending").length

  const handleOptimizeRoute = () => {
    setIsOptimizing(true)
    
    // Simulate optimization process with a delay
    setTimeout(() => {
      const result = optimizeRoute(deliveries, selectedAlgorithm)
      setOptimizationResult(result)
      setIsOptimizing(false)
    }, 2000)
  }

  const applyOptimization = () => {
    if (optimizationResult) {
      setOptimizedDeliveries(optimizationResult.optimizedOrder)
      setIsOptimizeDialogOpen(false)
    }
  }

  const resetOptimization = () => {
    setOptimizedDeliveries(deliveries)
    setOptimizationResult(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "pending":
        return "bg-gray-100 text-gray-600 border-gray-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "in-progress":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "pending":
        return <AlertCircle className="h-4 w-4 text-gray-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const filteredDeliveries = optimizedDeliveries.filter(delivery =>
    (delivery.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (delivery.location?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (delivery.item?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{route.name}</h1>
              <p className="text-sm text-gray-500">
                {route.distance} • {route.duration} • Driver: {getDriverName(route.driver)}
              </p>
            </div>
          </div>
                     <div className="flex items-center space-x-2">
             <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
               <Filter className="h-4 w-4 mr-2" />
               Live Tracking
             </Button>
             <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
               Schedule
             </Button>
             {optimizationResult && optimizedDeliveries !== deliveries && (
               <Badge className="bg-green-100 text-green-800 border-green-200">
                 <Zap className="h-3 w-3 mr-1" />
                 Route Optimized
               </Badge>
             )}
             <Badge className="bg-blue-100 text-blue-800 border-blue-200">
               4 Active Routes
             </Badge>
           </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalDeliveries}</div>
            <div className="text-sm text-gray-500">Total Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completedDeliveries}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{inProgressDeliveries}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{pendingDeliveries}</div>
            <div className="text-sm text-gray-500">Pending</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Deliveries List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Deliveries Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Today's Deliveries</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search deliveries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white border-gray-300"
              />
            </div>
          </div>

          {/* Deliveries List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-2">
              {filteredDeliveries.map((delivery) => (
                <Card
                  key={delivery.id}
                  className={`cursor-pointer border transition-all ${
                    selectedDelivery?.id === delivery.id
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  onClick={() => setSelectedDelivery(delivery)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(delivery.status)}
                        <span className="font-medium text-gray-900 text-sm">
                          {delivery.customer_name || 'Unknown Customer'}
                        </span>
                      </div>
                      <Badge className={`${getStatusColor(delivery.status)} text-xs`}>
                        {delivery.status}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900">{delivery.customer_name || 'Unknown Customer'}</div>
                      <div className="text-sm text-gray-600">{delivery.item || 'No item specified'}</div>
                      <div className="flex items-center text-xs text-gray-500">
                        <MapPin className="h-3 w-3 mr-1" />
                        {delivery.location || 'Address not provided'}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {delivery.drop_time || 'Not scheduled'}
                        </div>
                        {delivery.estimated_value && (
                          <div className="text-xs font-medium text-gray-900">
                            {delivery.estimated_value}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-100 space-y-2">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setIsOptimizeDialogOpen(true)}
            >
              <Zap className="h-4 w-4 mr-2" />
              Optimize Routes
            </Button>
            <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
              <Users className="h-4 w-4 mr-2" />
              Assign Drivers
            </Button>
          </div>
        </div>

        {/* Right Side - Map */}
        <div className="flex-1 bg-gray-50">
          <MapComponent
            deliveries={optimizedDeliveries}
            selectedDelivery={selectedDelivery}
            onDeliverySelect={setSelectedDelivery}
          />
        </div>
      </div>

      {/* Route Optimization Dialog */}
      <Dialog open={isOptimizeDialogOpen} onOpenChange={setIsOptimizeDialogOpen}>
        <DialogContent className="max-w-5xl w-[90vw] h-[80vh] bg-white border-gray-200 z-[100] overflow-hidden">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-gray-900 flex items-center text-xl">
              <Zap className="h-6 w-6 mr-2" />
              Route Optimization
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-6">
              {/* Algorithm Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="algorithm" className="text-gray-700 font-medium">
                    Optimization Algorithm
                  </Label>
                  <Select value={selectedAlgorithm} onValueChange={(value) => setSelectedAlgorithm(value as typeof selectedAlgorithm)}>
                    <SelectTrigger className="bg-white border-gray-300 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 z-[110]">
                      <SelectItem value="nearest-neighbor">Nearest Neighbor (Fast)</SelectItem>
                      <SelectItem value="2-opt">2-Opt Improvement (Good)</SelectItem>
                      <SelectItem value="genetic">Genetic Algorithm (Best)</SelectItem>
                      <SelectItem value="simulated-annealing">Simulated Annealing (Advanced)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedAlgorithm === 'nearest-neighbor' && 'Quick optimization using nearest point selection'}
                    {selectedAlgorithm === '2-opt' && 'Improves routes by swapping segments'}
                    {selectedAlgorithm === 'genetic' && 'Advanced optimization for best results'}
                    {selectedAlgorithm === 'simulated-annealing' && 'Probabilistic optimization method'}
                  </p>
                </div>
                
                <div className="flex items-end">
                  <Button
                    onClick={handleOptimizeRoute}
                    disabled={isOptimizing}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto"
                  >
                    {isOptimizing ? (
                      <>
                        <Settings className="h-4 w-4 mr-2 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Optimize Route
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Optimization Results */}
              {optimizationResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
                    <h3 className="text-lg font-medium text-green-900">Optimization Complete!</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-4 rounded border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-2">Original Route</h4>
                      <div className="space-y-1 text-sm">
                        <div>Distance: {formatDistance(optimizationResult.originalDistance)}</div>
                        <div>Duration: {formatDuration(optimizationResult.originalDuration)}</div>
                        <div>Cost: {formatCost(optimizationResult.originalDistance * 50 + optimizationResult.originalOrder.length * 100)}</div>
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded border border-green-200">
                      <h4 className="font-medium text-green-900 mb-2">Optimized Route</h4>
                      <div className="space-y-1 text-sm">
                        <div>Distance: {formatDistance(optimizationResult.optimizedDistance)}</div>
                        <div>Duration: {formatDuration(optimizationResult.optimizedDuration)}</div>
                        <div>Cost: {formatCost(optimizationResult.optimizedDistance * 50 + optimizationResult.optimizedOrder.length * 100)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button
                      variant="outline"
                      onClick={resetOptimization}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                    >
                      Reset to Original
                    </Button>
                    <Button
                      onClick={applyOptimization}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Apply Optimization
                    </Button>
                  </div>
                </div>
              )}

              {/* Current Route Info */}
              {!optimizationResult && !isOptimizing && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Current Route</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Stops:</span>
                      <span className="ml-2 font-medium text-gray-900">{deliveries.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Distance:</span>
                      <span className="ml-2 font-medium text-gray-900">{route.distance}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <span className="ml-2 font-medium text-gray-900">{route.duration}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 