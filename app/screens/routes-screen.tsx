"use client"

import { useState } from "react"
import { Plus, Edit, MapPin, Clock, Truck, MoreVertical, Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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

export default function RoutesScreen() {
  const [routes, setRoutes] = useState(mockRoutes)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

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
                    <span className="text-gray-900">{route.stops} stops</span>
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
                  >
                    View Map
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
