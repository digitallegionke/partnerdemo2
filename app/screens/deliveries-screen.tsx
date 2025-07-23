"use client"

import { useState } from "react"
import {
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  Filter,
  Download,
  Search,
  Eye,
  MoreVertical,
  Truck,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const mockDeliveries = [
  {
    id: "DEL-001",
    recipient: "John Kamau",
    address: "Kiambu Road, Nairobi",
    phone: "+254 712 345 678",
    status: "delivered",
    driver: "James Ochieng",
    driverAvatar: "JO",
    scheduledTime: "09:30 AM",
    deliveredTime: "09:45 AM",
    items: ["Tomatoes (5kg)", "Carrots (3kg)"],
    value: "KSh 2,500",
    priority: "high",
    date: "2024-01-15",
  },
  {
    id: "DEL-002",
    recipient: "Mary Wanjiku",
    address: "Thika Road, Thika",
    phone: "+254 723 456 789",
    status: "in-transit",
    driver: "Sarah Muthoni",
    driverAvatar: "SM",
    scheduledTime: "11:00 AM",
    deliveredTime: null,
    items: ["Spinach (2kg)", "Kale (4kg)"],
    value: "KSh 1,800",
    priority: "medium",
    date: "2024-01-15",
  },
  {
    id: "DEL-003",
    recipient: "Peter Mwangi",
    address: "Ruiru Town, Kiambu",
    phone: "+254 734 567 890",
    status: "pending",
    driver: "Unassigned",
    driverAvatar: "UN",
    scheduledTime: "02:15 PM",
    deliveredTime: null,
    items: ["Potatoes (8kg)", "Onions (5kg)"],
    value: "KSh 3,200",
    priority: "low",
    date: "2024-01-15",
  },
  {
    id: "DEL-004",
    recipient: "Grace Nyambura",
    address: "Kikuyu Town, Kiambu",
    phone: "+254 745 678 901",
    status: "failed",
    driver: "David Kiprop",
    driverAvatar: "DK",
    scheduledTime: "04:30 PM",
    deliveredTime: null,
    items: ["Beans (6kg)", "Maize (10kg)"],
    value: "KSh 2,100",
    priority: "high",
    date: "2024-01-14",
  },
]

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState(mockDeliveries)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("all")

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" || delivery.status === filterStatus
    const matchesDate = filterDate === "all" || delivery.date === filterDate
    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "in-transit":
        return <Truck className="h-4 w-4 text-blue-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200"
      case "in-transit":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "failed":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
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
              placeholder="Search deliveries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 bg-white border-gray-300"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-white border-gray-300">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="in-transit">In Transit</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger className="w-40 bg-white border-gray-300">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="2024-01-15">Today</SelectItem>
              <SelectItem value="2024-01-14">Yesterday</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Deliveries</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Delivered</p>
                <p className="text-2xl font-bold text-green-600">18</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Transit</p>
                <p className="text-2xl font-bold text-blue-600">4</p>
              </div>
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-red-600">2</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deliveries List */}
      <div className="space-y-4">
        {filteredDeliveries.map((delivery) => (
          <Card key={delivery.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(delivery.status)}
                      <span className="font-semibold text-gray-900">{delivery.id}</span>
                    </div>
                    <Badge className={getStatusColor(delivery.status)}>{delivery.status}</Badge>
                    <Badge className={getPriorityColor(delivery.priority)}>{delivery.priority}</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Recipient</h4>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <User className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-900">{delivery.recipient}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-600">{delivery.address}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-600">{delivery.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Items & Value</h4>
                      <div className="space-y-1">
                        {delivery.items.map((item, index) => (
                          <p key={index} className="text-sm text-gray-600">
                            {item}
                          </p>
                        ))}
                        <p className="text-sm font-medium text-gray-900 mt-2">{delivery.value}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Driver & Timing</h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                              {delivery.driverAvatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-900">{delivery.driver}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Clock className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-gray-600">Scheduled: {delivery.scheduledTime}</span>
                        </div>
                        {delivery.deliveredTime && (
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                            <span className="text-green-600">Delivered: {delivery.deliveredTime}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredDeliveries.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  )
}
