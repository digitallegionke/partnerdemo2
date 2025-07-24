"use client"

import { useState, useEffect } from "react"
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
  Plus,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DeliveryService } from "@/lib/services/deliveries"
import AddressSearch from "@/components/address-search"

// Transform Supabase delivery data to UI format
const transformDeliveryForUI = (delivery: any) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour24 = parseInt(hours)
    const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24
    const ampm = hour24 >= 12 ? 'PM' : 'AM'
    return `${hour12}:${minutes} ${ampm}`
  }

  const formatDate = (dateString: string) => {
    return dateString.split('T')[0]
  }

  const mapStatus = (status: string) => {
    switch (status) {
      case 'completed': return 'delivered'
      case 'in-progress': return 'in-transit'
      default: return status
    }
  }

  // Generate a better fallback name if customer_name is missing
  const generateFallbackName = (id: number) => {
    const fallbackNames = [
      'John Kamau', 'Mary Wanjiku', 'Peter Mutua', 'Grace Akinyi',
      'Samuel Kiprotich', 'Ruth Njeri', 'Joseph Mwangi', 'Agnes Wambui',
      'David Omondi', 'Helen Chebet', 'Michael Wekesa', 'Susan Moraa'
    ];
    return fallbackNames[id % fallbackNames.length] || 'Customer #' + id;
  }

  return {
    id: `DEL-${(delivery.id || 0).toString().padStart(3, '0')}`,
    recipient: delivery.customer_name && delivery.customer_name.trim() 
      ? delivery.customer_name.trim() 
      : generateFallbackName(delivery.id || 0),
    address: delivery.location || 'Address not provided',
    phone: delivery.phone || 'Not provided',
    status: mapStatus(delivery.status || 'pending'),
    driver: "Unassigned", // TODO: Add driver assignment logic
    driverAvatar: "UN",
    scheduledTime: delivery.drop_time ? formatTime(delivery.drop_time) : 'Not scheduled',
    deliveredTime: delivery.status === 'completed' && delivery.drop_time ? formatTime(delivery.drop_time) : null,
    items: [(delivery.item || 'No item specified') + (delivery.weight ? ` (${delivery.weight})` : '')],
    value: delivery.estimated_value || 'Not specified',
    priority: "medium", // TODO: Add priority logic
    date: delivery.created_at ? formatDate(delivery.created_at) : 'Unknown date',
  }
}

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    inTransit: 0,
    failed: 0
  })
  const [formData, setFormData] = useState({
    customer_name: "",
    location: "",
    latitude: "",
    longitude: "",
    item: "",
    estimated_value: "",
    weight: "",
    phone: "",
    drop_time: "",
  })

  // Load deliveries from Supabase
  const loadDeliveries = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await DeliveryService.getAllDeliveries()
      const transformedDeliveries = data.map(transformDeliveryForUI)
      setDeliveries(transformedDeliveries)
      
      // Calculate stats
      const newStats = {
        total: transformedDeliveries.length,
        delivered: transformedDeliveries.filter(d => d.status === 'delivered').length,
        inTransit: transformedDeliveries.filter(d => d.status === 'in-transit').length,
        failed: transformedDeliveries.filter(d => d.status === 'failed').length,
      }
      setStats(newStats)
    } catch (err) {
      console.error('Error loading deliveries:', err)
      setError('Failed to load deliveries. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Load deliveries on component mount
  useEffect(() => {
    loadDeliveries()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      customer_name: "",
      location: "",
      latitude: "",
      longitude: "",
      item: "",
      estimated_value: "",
      weight: "",
      phone: "",
      drop_time: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate coordinates
      const latitude = parseFloat(formData.latitude)
      const longitude = parseFloat(formData.longitude)
      
      if (isNaN(latitude) || isNaN(longitude)) {
        alert('Please select a valid delivery location with coordinates.')
        setIsSubmitting(false)
        return
      }

      const deliveryData = {
        customer_name: formData.customer_name,
        location: formData.location,
        coordinates: [latitude, longitude] as [number, number], // [lat, lng] format for frontend
        item: formData.item,
        estimated_value: formData.estimated_value || null,
        weight: formData.weight || null,
        phone: formData.phone,
        drop_time: formData.drop_time,
        status: 'pending' as const,
      } as const

      console.log('Submitting delivery with data:', deliveryData)
      
      await DeliveryService.createDelivery(deliveryData)
      
      // Reset form and close dialog
      resetForm()
      setIsAddDialogOpen(false)
      
      // Refresh deliveries list
      await loadDeliveries()
      
      console.log('Delivery created successfully')
      
    } catch (error) {
      console.error('Error creating delivery:', error)
      alert('Failed to create delivery. Please check the console for details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      (delivery.recipient?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (delivery.address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (delivery.id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          {/* Title and Main Actions */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
              <p className="text-sm text-gray-600 mt-1">Manage and track all your deliveries</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white shadow-sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
                             <Button 
                 variant="outline" 
                 className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white shadow-sm"
                 onClick={loadDeliveries}
               >
                 <RefreshCw className="h-4 w-4 mr-2" />
                 Refresh
               </Button>
               <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                 <DialogTrigger asChild>
                   <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                     <Plus className="h-4 w-4 mr-2" />
                     Add New Delivery
                   </Button>
                 </DialogTrigger>
            <DialogContent className="max-w-2xl bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900">Add New Delivery</DialogTitle>
                <DialogDescription>
                  Add a new delivery to the system. All fields are required.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name" className="text-sm font-medium text-gray-700">
                      Customer Name *
                    </Label>
                    <Input
                      id="customer_name"
                      type="text"
                      required
                      value={formData.customer_name}
                      onChange={(e) => handleInputChange("customer_name", e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="+254 712 345 678"
                      className="mt-1 bg-white border-gray-300"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                    Delivery Location *
                  </Label>
                  <AddressSearch
                    value={formData.location}
                    onSelect={(result) => {
                      handleInputChange("location", result.display_name);
                      handleInputChange("latitude", result.coordinates[0].toString());
                      handleInputChange("longitude", result.coordinates[1].toString());
                    }}
                    placeholder="Enter delivery address"
                    className="mt-1"
                    countryCode="ke"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="latitude" className="text-sm font-medium text-gray-700">
                      Latitude *
                    </Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => handleInputChange("latitude", e.target.value)}
                      placeholder="-1.2921"
                      className="mt-1 bg-white border-gray-300"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-filled when selecting an address above</p>
                  </div>
                  <div>
                    <Label htmlFor="longitude" className="text-sm font-medium text-gray-700">
                      Longitude *
                    </Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => handleInputChange("longitude", e.target.value)}
                      placeholder="36.8219"
                      className="mt-1 bg-white border-gray-300"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-filled when selecting an address above</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="item" className="text-sm font-medium text-gray-700">
                      Item *
                    </Label>
                    <Input
                      id="item"
                      type="text"
                      required
                      value={formData.item}
                      onChange={(e) => handleInputChange("item", e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="drop_time" className="text-sm font-medium text-gray-700">
                      Drop Time *
                    </Label>
                    <Input
                      id="drop_time"
                      type="time"
                      required
                      value={formData.drop_time}
                      onChange={(e) => handleInputChange("drop_time", e.target.value)}
                      className="mt-1 bg-white border-gray-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimated_value" className="text-sm font-medium text-gray-700">
                      Estimated Value
                    </Label>
                    <Input
                      id="estimated_value"
                      type="text"
                      value={formData.estimated_value}
                      onChange={(e) => handleInputChange("estimated_value", e.target.value)}
                      placeholder="KSh 2,500"
                      className="mt-1 bg-white border-gray-300"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight" className="text-sm font-medium text-gray-700">
                      Weight
                    </Label>
                    <Input
                      id="weight"
                      type="text"
                      value={formData.weight}
                      onChange={(e) => handleInputChange("weight", e.target.value)}
                      placeholder="5kg"
                      className="mt-1 bg-white border-gray-300"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
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
                    {isSubmitting ? "Creating..." : "Create Delivery"}
                  </Button>
                </div>
              </form>
                 </DialogContent>
               </Dialog>
             </div>
           </div>

           {/* Search and Filters */}
           <div className="flex items-center justify-between">
             <div className="flex items-center space-x-4">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                 <Input
                   placeholder="Search deliveries..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="pl-10 w-72 bg-white border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 />
               </div>
               <Select value={filterStatus} onValueChange={setFilterStatus}>
                 <SelectTrigger className="w-44 bg-white border-gray-300 shadow-sm">
                   <SelectValue placeholder="All Status" />
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
                 <SelectTrigger className="w-44 bg-white border-gray-300 shadow-sm">
                   <SelectValue placeholder="All Dates" />
                 </SelectTrigger>
                 <SelectContent className="bg-white border-gray-200">
                   <SelectItem value="all">All Dates</SelectItem>
                   <SelectItem value="2024-01-15">Today</SelectItem>
                   <SelectItem value="2024-01-14">Yesterday</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white shadow-sm">
               <Filter className="h-4 w-4 mr-2" />
               More Filters
             </Button>
           </div>
         </div>
       </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Deliveries</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Delivered</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.delivered}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">In Transit</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.inTransit}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Failed</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.failed}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading deliveries...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading deliveries</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button 
            onClick={loadDeliveries}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Deliveries List */}
      {!isLoading && !error && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Deliveries ({filteredDeliveries.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredDeliveries.length === 0 ? 'No deliveries found' : 'Manage your delivery orders'}
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredDeliveries.map((delivery) => (
                        <div key={delivery.id} className="p-6 hover:bg-gray-50 transition-colors">
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
                        {delivery.items.map((item: string, index: number) => (
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
            </div>
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
      )}
    </div>
  )
}
