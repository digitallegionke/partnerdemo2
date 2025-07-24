"use client"

import { useState } from "react"
import {
  Route,
  MapPin,
  Clock,
  Truck,
  Zap,
  TrendingUp,
  Settings,
  Play,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { optimizeMultipleRoutes, formatDistance, formatDuration, formatCost } from "@/lib/route-optimization"

// Sample routes with delivery data
const mockRoutes = [
  {
    route: {
      id: 1,
      name: "Nairobi Central Route",
      driver: "David Kimani"
    },
    deliveries: [
      { id: 1, customer_name: "John Kamau", location: "CBD Market", coordinates: [-1.2864, 36.8172] as [number, number], item: "Tomatoes", drop_time: "09:00 AM", status: "completed", phone: "+254712345678" },
      { id: 2, customer_name: "Mary Wanjiku", location: "City Hall", coordinates: [-1.2921, 36.8219] as [number, number], item: "Carrots", drop_time: "09:30 AM", status: "completed", phone: "+254723456789" },
      { id: 3, customer_name: "Peter Mutua", location: "Railway Station", coordinates: [-1.3067, 36.8321] as [number, number], item: "Potatoes", drop_time: "10:00 AM", status: "in-progress", phone: "+254734567890" },
      { id: 4, customer_name: "Grace Akinyi", location: "Central Park", coordinates: [-1.2884, 36.8233] as [number, number], item: "Onions", drop_time: "10:30 AM", status: "pending", phone: "+254745678901" },
    ]
  },
  {
    route: {
      id: 2,
      name: "Westlands Circuit",
      driver: "Sarah Wanjiku"
    },
    deliveries: [
      { id: 5, customer_name: "Samuel Kiprotich", location: "Westlands Mall", coordinates: [-1.2676, 36.8099] as [number, number], item: "Spinach", drop_time: "08:00 AM", status: "completed", phone: "+254756789012" },
      { id: 6, customer_name: "Ruth Njeri", location: "Sarit Centre", coordinates: [-1.2689, 36.8076] as [number, number], item: "Kales", drop_time: "08:45 AM", status: "completed", phone: "+254767890123" },
      { id: 7, customer_name: "Joseph Mwangi", location: "ABC Place", coordinates: [-1.2643, 36.8123] as [number, number], item: "Cabbages", drop_time: "09:30 AM", status: "completed", phone: "+254778901234" },
    ]
  }
]

export default function OptimizeScreen() {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationComplete, setOptimizationComplete] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'nearest-neighbor' | 'genetic' | '2-opt' | 'simulated-annealing'>("genetic")
  const [includeTraffic, setIncludeTraffic] = useState(true)
  const [prioritizeTime, setPrioritizeTime] = useState(false)
  const [optimizationResults, setOptimizationResults] = useState<any[]>([])

  const handleOptimize = () => {
    setIsOptimizing(true)
    setOptimizationComplete(false)

    // Run actual optimization
    setTimeout(() => {
      const results = optimizeMultipleRoutes(mockRoutes, selectedAlgorithm)
      setOptimizationResults(results)
      setIsOptimizing(false)
      setOptimizationComplete(true)
    }, 3000)
  }

  // Calculate current route metrics
  const getCurrentRouteMetrics = (routeData: typeof mockRoutes[0]) => {
    const result = optimizeMultipleRoutes([routeData], 'nearest-neighbor')[0]
    return {
      distance: formatDistance(result.originalDistance),
      duration: formatDuration(result.originalDuration),
      cost: formatCost(result.originalDistance * 50 + result.originalOrder.length * 100),
      efficiency: Math.max(60, Math.round(90 - (result.originalDistance * 2))) // Mock efficiency based on distance
    }
  }

  return (
    <div className="p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
          <Button onClick={handleOptimize} disabled={isOptimizing} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isOptimizing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Optimization
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Optimization Settings */}
        <div className="lg:col-span-1">
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900">
                <Settings className="h-5 w-5 mr-2" />
                Optimization Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="algorithm" className="text-gray-700">
                  Algorithm
                </Label>
                <Select value={selectedAlgorithm} onValueChange={(value) => setSelectedAlgorithm(value as typeof selectedAlgorithm)}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="genetic">Genetic Algorithm</SelectItem>
                    <SelectItem value="ant-colony">Ant Colony</SelectItem>
                    <SelectItem value="simulated-annealing">Simulated Annealing</SelectItem>
                    <SelectItem value="nearest-neighbor">Nearest Neighbor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Optimization Factors</h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="traffic" className="text-gray-700">
                      Include Traffic Data
                    </Label>
                    <p className="text-sm text-gray-500">Use real-time traffic information</p>
                  </div>
                  <Switch id="traffic" checked={includeTraffic} onCheckedChange={setIncludeTraffic} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="time-priority" className="text-gray-700">
                      Prioritize Time
                    </Label>
                    <p className="text-sm text-gray-500">Optimize for speed over distance</p>
                  </div>
                  <Switch id="time-priority" checked={prioritizeTime} onCheckedChange={setPrioritizeTime} />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Constraints</h4>
                <div>
                  <Label htmlFor="max-stops" className="text-gray-700">
                    Max Stops per Route
                  </Label>
                  <Select defaultValue="10">
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="5">5 stops</SelectItem>
                      <SelectItem value="8">8 stops</SelectItem>
                      <SelectItem value="10">10 stops</SelectItem>
                      <SelectItem value="15">15 stops</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max-duration" className="text-gray-700">
                    Max Route Duration
                  </Label>
                  <Select defaultValue="4">
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="8">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {/* Optimization Progress */}
          {isOptimizing && (
            <Card className="bg-white border border-gray-200 mb-6">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Optimizing Routes...</h3>
                    <p className="text-sm text-gray-600">Analyzing delivery points and calculating optimal paths</p>
                    <Progress value={65} className="mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optimization Complete */}
          {optimizationComplete && (
            <Card className="bg-green-50 border border-green-200 mb-6">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-medium text-green-900">Optimization Complete!</h3>
                    <p className="text-sm text-green-700">Found improved routes with 18% better efficiency</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparison Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Current Routes */}
            <Card className="bg-white border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900">
                  <Route className="h-5 w-5 mr-2" />
                  Current Routes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRoutes.map((routeData) => {
                    const metrics = getCurrentRouteMetrics(routeData)
                    return (
                      <div key={routeData.route.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{routeData.route.name}</h4>
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                            {metrics.efficiency}% efficient
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">{metrics.distance}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">{metrics.duration}</span>
                          </div>
                          <div className="flex items-center">
                            <Truck className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">{routeData.deliveries.length} stops</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-gray-500">Cost:</span>
                            <span className="text-gray-900 font-medium ml-1">{metrics.cost}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Optimized Routes */}
            <Card className="bg-white border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900">
                  <Zap className="h-5 w-5 mr-2 text-green-600" />
                  Optimized Routes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {optimizationComplete ? (
                    optimizationResults.map((result) => {
                      const route = mockRoutes.find(r => r.route.id === result.routeId)?.route
                      const optimizedEfficiency = Math.min(95, Math.round(90 + result.improvementPercent))
                      return (
                        <div key={result.routeId} className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">Optimized {route?.name}</h4>
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              {optimizedEfficiency}% efficient
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-600">{formatDistance(result.optimizedDistance)}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-600">{formatDuration(result.optimizedDuration)}</span>
                            </div>
                            <div className="flex items-center">
                              <Truck className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-600">{result.optimizedOrder.length} stops</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-500">Cost:</span>
                              <span className="text-gray-900 font-medium ml-1">
                                {formatCost(result.optimizedDistance * 50 + result.optimizedOrder.length * 100)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-green-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-green-700">Savings:</span>
                              <span className="text-sm font-medium text-green-800">{formatCost(result.costSavings)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Run optimization to see improved routes</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          {optimizationComplete && (
            <Card className="bg-white border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Optimization Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">18%</div>
                    <div className="text-sm text-gray-500">Efficiency Improvement</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">12.3 km</div>
                    <div className="text-sm text-gray-500">Distance Saved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">45 min</div>
                    <div className="text-sm text-gray-500">Time Saved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">KSh 900</div>
                    <div className="text-sm text-gray-500">Cost Savings</div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex justify-center space-x-4">
                    <Button className="bg-green-600 hover:bg-green-700 text-white">Apply Optimization</Button>
                    <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
                      Save as Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
