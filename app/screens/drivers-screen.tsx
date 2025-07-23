"use client"

import { useState } from "react"
import {
  Plus,
  Edit,
  Phone,
  Mail,
  MapPin,
  Star,
  MoreVertical,
  Download,
  Search,
  User,
  Truck,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const mockDrivers = [
  {
    id: 1,
    name: "James Ochieng",
    email: "james.ochieng@safemoon.com",
    phone: "+254 712 345 678",
    status: "active",
    location: "Nairobi CBD",
    vehicle: "Toyota Hiace - KCA 123A",
    rating: 4.8,
    totalDeliveries: 156,
    completedToday: 8,
    joinDate: "2023-06-15",
    avatar: "JO",
    lastActive: "2 minutes ago",
    efficiency: 94,
  },
  {
    id: 2,
    name: "Sarah Muthoni",
    email: "sarah.muthoni@safemoon.com",
    phone: "+254 723 456 789",
    status: "active",
    location: "Westlands",
    vehicle: "Nissan NV200 - KBZ 456B",
    rating: 4.9,
    totalDeliveries: 203,
    completedToday: 6,
    joinDate: "2023-04-20",
    avatar: "SM",
    lastActive: "5 minutes ago",
    efficiency: 96,
  },
  {
    id: 3,
    name: "David Kiprop",
    email: "david.kiprop@safemoon.com",
    phone: "+254 734 567 890",
    status: "offline",
    location: "Karen",
    vehicle: "Isuzu D-Max - KCX 789C",
    rating: 4.6,
    totalDeliveries: 89,
    completedToday: 0,
    joinDate: "2023-08-10",
    avatar: "DK",
    lastActive: "2 hours ago",
    efficiency: 88,
  },
  {
    id: 4,
    name: "Grace Wanjiku",
    email: "grace.wanjiku@safemoon.com",
    phone: "+254 745 678 901",
    status: "busy",
    location: "Thika Road",
    vehicle: "Mitsubishi Canter - KDA 012D",
    rating: 4.7,
    totalDeliveries: 134,
    completedToday: 4,
    joinDate: "2023-07-05",
    avatar: "GW",
    lastActive: "1 minute ago",
    efficiency: 91,
  },
]

export default function DriversScreen() {
  const [drivers, setDrivers] = useState(mockDrivers)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone.includes(searchTerm)
    const matchesStatus = filterStatus === "all" || driver.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "busy":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "offline":
        return "bg-gray-100 text-gray-600 border-gray-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "busy":
        return "bg-yellow-500"
      case "offline":
        return "bg-gray-400"
      default:
        return "bg-gray-400"
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
              placeholder="Search drivers..."
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
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
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
                Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-gray-200 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Add New Driver</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="driverName" className="text-gray-700">
                    Full Name
                  </Label>
                  <Input id="driverName" placeholder="Enter driver name" className="bg-white border-gray-300" />
                </div>
                <div>
                  <Label htmlFor="email" className="text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="driver@safemoon.com"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-gray-700">
                    Phone Number
                  </Label>
                  <Input id="phone" placeholder="+254 7XX XXX XXX" className="bg-white border-gray-300" />
                </div>
                <div>
                  <Label htmlFor="vehicle" className="text-gray-700">
                    Vehicle Details
                  </Label>
                  <Input
                    id="vehicle"
                    placeholder="Vehicle model and plate number"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                  >
                    Cancel
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">Add Driver</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Drivers</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">8</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">On Delivery</p>
                <p className="text-2xl font-bold text-yellow-600">3</p>
              </div>
              <Truck className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Rating</p>
                <p className="text-2xl font-bold text-gray-900">4.7</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDrivers.map((driver) => (
          <Card key={driver.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={`/placeholder.svg?height=48&width=48`} />
                      <AvatarFallback className="bg-gray-100 text-gray-600">{driver.avatar}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusDot(driver.status)}`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-gray-900">{driver.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(driver.status)}>{driver.status}</Badge>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                        <span className="text-sm text-gray-600">{driver.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600 truncate">{driver.email}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">{driver.phone}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">{driver.location}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Truck className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-gray-600 truncate">{driver.vehicle}</span>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Total Deliveries</p>
                    <p className="font-medium text-gray-900">{driver.totalDeliveries}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Today</p>
                    <p className="font-medium text-gray-900">{driver.completedToday}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Efficiency</p>
                    <p className="font-medium text-green-600">{driver.efficiency}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Active</p>
                    <p className="font-medium text-gray-600">{driver.lastActive}</p>
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
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredDrivers.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Add First Driver
          </Button>
        </div>
      )}
    </div>
  )
}
