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

const mockOptimizationData = {
  currentRoutes: [
    {
      id: 1,
      name: "Route A",
      distance: "45.2 km",
      duration: "2h 30m",
      stops: 8,
      efficiency: 72,
      cost: "KSh 2,400",
    },
    {
      id: 2,
      name: "Route B",
      distance: "38.7 km",
      duration: "2h 10m",
      stops: 6,
      efficiency: 68,
      cost: "KSh 2,100",
    },
  ],
  optimizedRoutes: [
    {
      id: 1,
      name: "Optimized Route A",
      distance: "38.5 km",
      duration: "2h 05m",
      stops: 8,
      efficiency: 89,
      cost: "KSh 1,950",
      savings: "KSh 450",
    },
    {
      id: 2,
      name: "Optimized Route B",
      distance: "32.1 km",
      duration: "1h 45m",
      stops: 6,
      efficiency: 92,
      cost: "KSh 1,650",
      savings: "KSh 450",
    },
  ],
}

export default function OptimizeScreen() {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationComplete, setOptimizationComplete] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("genetic")
  const [includeTraffic, setIncludeTraffic] = useState(true)
  const [prioritizeTime, setPrioritizeTime] = useState(false)

  const handleOptimize = () => {
    setIsOptimizing(true)
    setOptimizationComplete(false)

    // Simulate optimization process
    setTimeout(() => {
      setIsOptimizing(false)
      setOptimizationComplete(true)
    }, 3000)
  }

  return (
    <div className="p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Route Optimization</h2>
          <p className="text-gray-600">Optimize delivery routes for maximum efficiency</p>
        </div>
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
                <Select value={selectedAlgorithm} onValueChange={setSelectedAlgorithm}>
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
                  {mockOptimizationData.currentRoutes.map((route) => (
                    <div key={route.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{route.name}</h4>
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                          {route.efficiency}% efficient
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-600">{route.distance}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-600">{route.duration}</span>
                        </div>
                        <div className="flex items-center">
                          <Truck className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-600">{route.stops} stops</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-500">Cost:</span>
                          <span className="text-gray-900 font-medium ml-1">{route.cost}</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    mockOptimizationData.optimizedRoutes.map((route) => (
                      <div key={route.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{route.name}</h4>
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            {route.efficiency}% efficient
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">{route.distance}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">{route.duration}</span>
                          </div>
                          <div className="flex items-center">
                            <Truck className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-gray-600">{route.stops} stops</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-gray-500">Cost:</span>
                            <span className="text-gray-900 font-medium ml-1">{route.cost}</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-green-700">Savings:</span>
                            <span className="text-sm font-medium text-green-800">{route.savings}</span>
                          </div>
                        </div>
                      </div>
                    ))
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
