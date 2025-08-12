"use client"

import { useState, useEffect } from "react"
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
  RefreshCw,
  AlertCircle,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { DriverService } from "@/lib/services/drivers"

// Transform Supabase driver data to UI format
const transformDriverForUI = (driver: any) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const getLocationFromVehicle = (vehicleType: string) => {
    // Default locations based on vehicle type - this could be enhanced
    const locations = {
      'Motorcycle': 'CBD',
      'Van': 'Westlands', 
      'Truck': 'Industrial Area',
    }
    return locations[vehicleType as keyof typeof locations] || 'Nairobi'
  }

  const formatDate = (dateString: string) => {
    return dateString.split('T')[0]
  }

  const mapStatus = (status: string) => {
    switch (status) {
      case 'on_break': return 'busy'
      case 'inactive': return 'offline'
      default: return status
    }
  }

  return {
    id: driver.id,
    name: driver.name,
    email: driver.email || `${driver.name.toLowerCase().replace(/\s+/g, '.')}@roundi.com`,
    phone: driver.phone,
    status: mapStatus(driver.status),
    location: getLocationFromVehicle(driver.vehicle_type),
    vehicle: `${driver.vehicle_type} - ${driver.license_number}`,
    rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
    totalDeliveries: Math.floor(Math.random() * 200) + 50, // Random between 50-250
    completedToday: driver.status === 'active' ? Math.floor(Math.random() * 10) : 0,
    joinDate: formatDate(driver.created_at),
    avatar: getInitials(driver.name),
    lastActive: driver.status === 'active' ? `${Math.floor(Math.random() * 30) + 1}m ago` : 
                driver.status === 'on_break' ? `${Math.floor(Math.random() * 2) + 1}h ago` : 
                `${Math.floor(Math.random() * 24) + 1}h ago`,
    efficiency: Math.floor(Math.random() * 15) + 85, // Random between 85-100%
  }
}

export default function DriversScreen() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any>(null)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    busy: 0,
    offline: 0,
    avgRating: 0
  })
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    vehicle_type: "",
    license_number: "",
    status: "active"
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Load drivers from Supabase
  const loadDrivers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await DriverService.getAllDrivers()
      const transformedDrivers = data.map(transformDriverForUI)
      setDrivers(transformedDrivers)
      
      // Calculate stats
      const newStats = {
        total: transformedDrivers.length,
        active: transformedDrivers.filter(d => d.status === 'active').length,
        busy: transformedDrivers.filter(d => d.status === 'busy').length,
        offline: transformedDrivers.filter(d => d.status === 'offline').length,
        avgRating: transformedDrivers.length > 0 ? 
          Math.round((transformedDrivers.reduce((sum, d) => sum + d.rating, 0) / transformedDrivers.length) * 10) / 10 : 0
      }
      setStats(newStats)
    } catch (err) {
      console.error('Error loading drivers:', err)
      setError('Failed to load drivers. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Load drivers on component mount
  useEffect(() => {
    loadDrivers()
  }, [])

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      errors.name = "Name is required"
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters"
    }
    
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required"
    } else if (!/^\+?[\d\s-]{10,}$/.test(formData.phone.trim())) {
      errors.phone = "Please enter a valid phone number"
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address"
    }
    
    if (!formData.vehicle_type) {
      errors.vehicle_type = "Vehicle type is required"
    }
    
    if (!formData.license_number.trim()) {
      errors.license_number = "License number is required"
    } else if (formData.license_number.trim().length < 3) {
      errors.license_number = "License number must be at least 3 characters"
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      vehicle_type: "",
      license_number: "",
      status: "active"
    })
    setFormErrors({})
  }

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditDialogOpen) {
        setIsEditDialogOpen(false)
        setEditingDriver(null)
        resetForm()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isEditDialogOpen])

  // Handle edit driver
  const handleEditDriver = (driver: any) => {
    setEditingDriver(driver)
    
    // Reverse the status mapping for editing
    const getRawStatus = (uiStatus: string) => {
      switch (uiStatus) {
        case 'busy': return 'on_break'
        case 'offline': return 'inactive'
        default: return uiStatus
      }
    }

    // Parse vehicle information safely
    let vehicleType = ''
    let licenseNumber = ''
    
    if (driver.vehicle && typeof driver.vehicle === 'string') {
      const parts = driver.vehicle.split(' - ')
      vehicleType = parts[0] || ''
      licenseNumber = parts[1] || ''
    }

    setFormData({
      name: driver.name || '',
      email: (driver.email && !driver.email.includes('@roundi.com')) ? driver.email : '',
      phone: driver.phone || '',
      vehicle_type: vehicleType,
      license_number: licenseNumber,
      status: getRawStatus(driver.status) || 'active'
    })
    
    setIsEditDialogOpen(true)
  }

  // Handle update driver
  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDriver) return
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)

    try {
      const driverData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type,
        license_number: formData.license_number,
        status: formData.status as 'active' | 'on_break' | 'inactive',
      }

      await DriverService.updateDriver(editingDriver.id, driverData)
      
      // Reset form and close dialog
      resetForm()
      setIsEditDialogOpen(false)
      setEditingDriver(null)
      
      // Refresh drivers list
      await loadDrivers()
      
    } catch (error) {
      console.error('Error updating driver:', error)
      // TODO: Show error toast notification
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)

    try {
      const driverData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type,
        license_number: formData.license_number,
        status: 'active' as const,
      }

      await DriverService.createDriver(driverData)
      
      // Reset form and close dialog
      resetForm()
      setIsAddDialogOpen(false)
      
      // Refresh drivers list
      await loadDrivers()
      
    } catch (error) {
      console.error('Error creating driver:', error)
      // TODO: Show error toast notification
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredDrivers = drivers.filter((driver: any) => {
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
        return "bg-green-50 text-green-700 border-green-200"
      case "busy":
        return "bg-orange-50 text-orange-700 border-orange-200"
      case "offline":
        return "bg-gray-50 text-gray-700 border-gray-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "busy":
        return "bg-orange-500"
      case "offline":
        return "bg-gray-400"
      default:
        return "bg-gray-400"
    }
  }

  // Helper component for form field errors
  const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null
    return (
      <p className="text-sm text-red-600 mt-1 flex items-center">
        <AlertCircle className="h-3 w-3 mr-1" />
        {error}
      </p>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
              <p className="text-gray-600 mt-1">Manage your delivery team and assignments</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadDrivers}
                className="text-gray-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-gray-600"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Driver
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Driver</DialogTitle>
                    <DialogDescription>
                      Add a new driver to your team.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="driverName">Name *</Label>
                      <Input 
                        id="driverName" 
                        placeholder="Enter driver name" 
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        className={formErrors.name ? "border-red-500 focus:border-red-500" : ""}
                        required
                      />
                      <FieldError error={formErrors.name} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="driver@roundi.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className={formErrors.email ? "border-red-500 focus:border-red-500" : ""}
                      />
                      <FieldError error={formErrors.email} />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input 
                        id="phone" 
                        placeholder="+254 7XX XXX XXX" 
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className={formErrors.phone ? "border-red-500 focus:border-red-500" : ""}
                        required
                      />
                      <FieldError error={formErrors.phone} />
                    </div>
                    <div>
                      <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                      <Select value={formData.vehicle_type} onValueChange={(value) => handleInputChange("vehicle_type", value)}>
                        <SelectTrigger className={formErrors.vehicle_type ? "border-red-500 focus:border-red-500" : ""}>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="Van">Van</SelectItem>
                          <SelectItem value="Truck">Truck</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={formErrors.vehicle_type} />
                    </div>
                    <div>
                      <Label htmlFor="license_number">License Number *</Label>
                      <Input
                        id="license_number"
                        placeholder="KCA123D"
                        value={formData.license_number}
                        onChange={(e) => handleInputChange("license_number", e.target.value)}
                        className={formErrors.license_number ? "border-red-500 focus:border-red-500" : ""}
                        required
                      />
                      <FieldError error={formErrors.license_number} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm()
                          setIsAddDialogOpen(false)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isSubmitting || !formData.name || !formData.phone || !formData.vehicle_type || !formData.license_number}
                      >
                        {isSubmitting ? "Adding..." : "Add Driver"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Edit Driver Dialog */}
              {isEditDialogOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                  <div 
                    className="fixed inset-0 bg-black bg-opacity-50" 
                    onClick={() => setIsEditDialogOpen(false)}
                  />
                  <div className="relative z-[101] w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl border border-gray-300 max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-4">
                        <h2 className="text-xl font-bold text-blue-900 flex items-center">
                          <Edit className="h-5 w-5 mr-2" />
                          Edit Driver: {editingDriver?.name || 'Unknown'}
                        </h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditDialogOpen(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <form onSubmit={handleUpdateDriver} className="space-y-4">
                    <div>
                      <Label htmlFor="editDriverName">Name *</Label>
                      <Input 
                        id="editDriverName" 
                        placeholder="Enter driver name" 
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        className={formErrors.name ? "border-red-500 focus:border-red-500" : ""}
                        required
                      />
                      <FieldError error={formErrors.name} />
                    </div>
                    <div>
                      <Label htmlFor="editEmail">Email</Label>
                      <Input
                        id="editEmail"
                        type="email"
                        placeholder="driver@roundi.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className={formErrors.email ? "border-red-500 focus:border-red-500" : ""}
                      />
                      <FieldError error={formErrors.email} />
                    </div>
                    <div>
                      <Label htmlFor="editPhone">Phone *</Label>
                      <Input 
                        id="editPhone" 
                        placeholder="+254 7XX XXX XXX" 
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className={formErrors.phone ? "border-red-500 focus:border-red-500" : ""}
                        required
                      />
                      <FieldError error={formErrors.phone} />
                    </div>
                    <div>
                      <Label htmlFor="editVehicleType">Vehicle Type *</Label>
                      <Select value={formData.vehicle_type} onValueChange={(value) => handleInputChange("vehicle_type", value)}>
                        <SelectTrigger className={formErrors.vehicle_type ? "border-red-500 focus:border-red-500" : ""}>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="Van">Van</SelectItem>
                          <SelectItem value="Truck">Truck</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={formErrors.vehicle_type} />
                    </div>
                    <div>
                      <Label htmlFor="editLicenseNumber">License Number *</Label>
                      <Input
                        id="editLicenseNumber"
                        placeholder="KCA123D"
                        value={formData.license_number}
                        onChange={(e) => handleInputChange("license_number", e.target.value)}
                        className={formErrors.license_number ? "border-red-500 focus:border-red-500" : ""}
                        required
                      />
                      <FieldError error={formErrors.license_number} />
                    </div>
                    <div>
                      <Label htmlFor="editStatus">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_break">On Break</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm()
                          setIsEditDialogOpen(false)
                          setEditingDriver(null)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isSubmitting || !formData.name || !formData.phone || !formData.vehicle_type || !formData.license_number}
                      >
                        {isSubmitting ? "Updating..." : "Update Driver"}
                      </Button>
                    </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
                <User className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.active}</p>
                </div>
                <Activity className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">On Delivery</p>
                  <p className="text-2xl font-semibold text-orange-600">{stats.busy}</p>
                </div>
                <Truck className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.avgRating}</p>
                </div>
                <Star className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading drivers...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading drivers</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadDrivers}>
              Try Again
            </Button>
          </div>
        )}

        {/* Drivers Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrivers.map((driver) => (
              <Card key={driver.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={`/placeholder.svg?height=40&width=40`} />
                          <AvatarFallback className="bg-gray-100 text-gray-700 text-sm">
                            {driver.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusDot(driver.status)}`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base text-gray-900">{driver.name}</CardTitle>
                        <Badge className={`${getStatusColor(driver.status)} text-xs mt-1`} variant="outline">
                          {driver.status === 'busy' ? 'On delivery' : driver.status}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Contact Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{driver.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{driver.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{driver.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck className="h-4 w-4" />
                      <span className="truncate">{driver.vehicle}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Deliveries</p>
                      <p className="font-medium text-gray-900">{driver.totalDeliveries}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rating</p>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        <span className="font-medium text-gray-900">{driver.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500">Today</p>
                      <p className="font-medium text-gray-900">{driver.completedToday}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last active</p>
                      <p className="font-medium text-gray-900">{driver.lastActive}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleEditDriver(driver)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredDrivers.length === 0 && !isLoading && !error && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== "all" 
                ? "Try adjusting your search or filter criteria." 
                : "Get started by adding your first driver."}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
