"use client"

import React, { useState, useEffect } from "react"
import { ArrowLeft, Plus, MapPin, Edit3, Trash2, Search, Clock, Users, Navigation, Phone, Mail, AlertCircle, CheckCircle, Building2, Car, Bike } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type CollectionPoint = {
  id: number
  name: string
  address: string
  coordinates: [number, number] // [lat, lng]
  type: 'warehouse' | 'depot' | 'pickup-point' | 'hub'
  capacity: number
  operatingHours: {
    open: string
    close: string
  }
  contactPerson: string
  phone: string
  email?: string
  status: 'active' | 'inactive' | 'maintenance'
  assignedVehicles: number
  description?: string
  createdAt: string
  lastUpdated: string
}

interface CollectionPointsScreenProps {
  onBack: () => void
}

// Mock data - in a real app, this would come from an API
const mockCollectionPoints: CollectionPoint[] = [
  {
    id: 1,
    name: "Central Warehouse Nairobi",
    address: "Industrial Area, Nairobi, Kenya",
    coordinates: [-1.3192, 36.8285],
    type: 'warehouse',
    capacity: 200,
    operatingHours: { open: "06:00", close: "20:00" },
    contactPerson: "John Kimani",
    phone: "+254 712 345 678",
    email: "john.kimani@company.com",
    status: 'active',
    assignedVehicles: 15,
    description: "Main distribution center for Nairobi region",
    createdAt: "2024-01-15",
    lastUpdated: "2024-08-10"
  },
  {
    id: 2,
    name: "Westlands Pickup Hub",
    address: "Westlands, Nairobi, Kenya", 
    coordinates: [-1.2674, 36.8075],
    type: 'hub',
    capacity: 50,
    operatingHours: { open: "07:00", close: "18:00" },
    contactPerson: "Mary Wanjiku",
    phone: "+254 722 345 678",
    status: 'active',
    assignedVehicles: 8,
    description: "Customer pickup and drop-off point",
    createdAt: "2024-02-20",
    lastUpdated: "2024-08-09"
  },
  {
    id: 3,
    name: "Mombasa Depot",
    address: "Mombasa Road, Mombasa, Kenya",
    coordinates: [-4.0435, 39.6682],
    type: 'depot',
    capacity: 100,
    operatingHours: { open: "05:00", close: "22:00" },
    contactPerson: "Ali Hassan",
    phone: "+254 733 345 678",
    email: "ali.hassan@company.com",
    status: 'maintenance',
    assignedVehicles: 0,
    description: "Under maintenance - electrical upgrades",
    createdAt: "2024-01-10",
    lastUpdated: "2024-08-11"
  },
  {
    id: 4,
    name: "Kisumu Pickup Point",
    address: "Kisumu Town, Kisumu, Kenya",
    coordinates: [-0.0917, 34.7680],
    type: 'pickup-point',
    capacity: 25,
    operatingHours: { open: "08:00", close: "17:00" },
    contactPerson: "Grace Ochieng",
    phone: "+254 744 345 678",
    status: 'active',
    assignedVehicles: 3,
    createdAt: "2024-03-05",
    lastUpdated: "2024-08-08"
  }
]

export default function CollectionPointsScreen({ onBack }: CollectionPointsScreenProps) {
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>(mockCollectionPoints)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<CollectionPoint | null>(null)
  const [deletingPoint, setDeleteingPoint] = useState<CollectionPoint | null>(null)

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    type: "warehouse" as CollectionPoint['type'],
    capacity: 50,
    operatingHours: { open: "08:00", close: "17:00" },
    contactPerson: "",
    phone: "",
    email: "",
    description: ""
  })

  // Reset form data
  const resetFormData = () => {
    setFormData({
      name: "",
      address: "",
      type: "warehouse",
      capacity: 50,
      operatingHours: { open: "08:00", close: "17:00" },
      contactPerson: "",
      phone: "",
      email: "",
      description: ""
    })
  }

  // Handle create collection point
  const handleCreate = () => {
    const newPoint: CollectionPoint = {
      id: Math.max(...collectionPoints.map(p => p.id)) + 1,
      ...formData,
      coordinates: [-1.2921, 36.8219] as [number, number], // Default Nairobi coordinates
      status: 'active',
      assignedVehicles: 0,
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0]
    }

    setCollectionPoints([...collectionPoints, newPoint])
    setIsCreateDialogOpen(false)
    resetFormData()
  }

  // Handle edit collection point
  const handleEdit = (point: CollectionPoint) => {
    setEditingPoint(point)
    setFormData({
      name: point.name,
      address: point.address,
      type: point.type,
      capacity: point.capacity,
      operatingHours: point.operatingHours,
      contactPerson: point.contactPerson,
      phone: point.phone,
      email: point.email || "",
      description: point.description || ""
    })
    setIsEditDialogOpen(true)
  }

  // Handle update collection point
  const handleUpdate = () => {
    if (!editingPoint) return

    const updatedPoints = collectionPoints.map(point =>
      point.id === editingPoint.id
        ? {
            ...point,
            ...formData,
            lastUpdated: new Date().toISOString().split('T')[0]
          }
        : point
    )

    setCollectionPoints(updatedPoints)
    setIsEditDialogOpen(false)
    setEditingPoint(null)
    resetFormData()
  }

  // Handle delete collection point
  const handleDelete = (point: CollectionPoint) => {
    setDeleteingPoint(point)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const confirmDelete = () => {
    if (!deletingPoint) return

    setCollectionPoints(collectionPoints.filter(point => point.id !== deletingPoint.id))
    setIsDeleteDialogOpen(false)
    setDeleteingPoint(null)
  }

  // Filter collection points
  const filteredPoints = collectionPoints.filter(point => {
    const matchesSearch = point.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         point.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         point.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = selectedType === "all" || point.type === selectedType
    const matchesStatus = selectedStatus === "all" || point.status === selectedStatus

    return matchesSearch && matchesType && matchesStatus
  })

  // Get status styling
  const getStatusBadge = (status: CollectionPoint['status']) => {
    switch (status) {
      case 'active':
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case 'inactive':
        return "bg-slate-100 text-slate-600 border-slate-200"
      case 'maintenance':
        return "bg-amber-100 text-amber-800 border-amber-200"
      default:
        return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  // Get type icon
  const getTypeIcon = (type: CollectionPoint['type']) => {
    switch (type) {
      case 'warehouse':
        return <Building2 className="h-4 w-4" />
      case 'depot':
        return <Car className="h-4 w-4" />
      case 'hub':
        return <Navigation className="h-4 w-4" />
      case 'pickup-point':
        return <Bike className="h-4 w-4" />
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Collection Points</h1>
                <p className="text-sm text-slate-600 mt-1">Manage pickup and delivery starting points</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Collection Point
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search collection points..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-48 bg-white border-slate-200">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
              <SelectItem value="depot">Depot</SelectItem>
              <SelectItem value="hub">Hub</SelectItem>
              <SelectItem value="pickup-point">Pickup Point</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-48 bg-white border-slate-200">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Points</p>
                  <p className="text-2xl font-bold text-blue-900">{collectionPoints.length}</p>
                </div>
                <MapPin className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Active</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {collectionPoints.filter(p => p.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Maintenance</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {collectionPoints.filter(p => p.status === 'maintenance').length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {collectionPoints.reduce((sum, p) => sum + p.assignedVehicles, 0)}
                  </p>
                </div>
                <Car className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Collection Points List */}
      <div className="flex-1 p-6 overflow-auto">
        {filteredPoints.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No collection points found</h3>
              <p className="text-slate-500 mb-4">
                {searchTerm || selectedType !== "all" || selectedStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first collection point"
                }
              </p>
              {!searchTerm && selectedType === "all" && selectedStatus === "all" && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Collection Point
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPoints.map((point) => (
              <Card key={point.id} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        {getTypeIcon(point.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-slate-900">{point.name}</CardTitle>
                        <p className="text-sm text-slate-500 capitalize">{point.type.replace('-', ' ')}</p>
                      </div>
                    </div>
                    <Badge className={getStatusBadge(point.status)}>
                      {point.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{point.address}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600">
                        {point.operatingHours.open} - {point.operatingHours.close}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{point.contactPerson}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{point.phone}</span>
                    </div>

                    {point.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-600">{point.email}</span>
                      </div>
                    )}
                  </div>

                  {point.description && (
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                      {point.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <span>Capacity: {point.capacity}</span>
                      <span>Vehicles: {point.assignedVehicles}</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(point)}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(point)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false)
          setIsEditDialogOpen(false)
          setEditingPoint(null)
          resetFormData()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span>{isCreateDialogOpen ? "Add New Collection Point" : "Edit Collection Point"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Collection point name"
                  className="border-slate-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value as CollectionPoint['type']})}>
                  <SelectTrigger className="border-slate-200 focus:border-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="depot">Depot</SelectItem>
                    <SelectItem value="hub">Hub</SelectItem>
                    <SelectItem value="pickup-point">Pickup Point</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full address"
                className="border-slate-200 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                  placeholder="Max capacity"
                  className="border-slate-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="open-time">Opening Time</Label>
                <Input
                  id="open-time"
                  type="time"
                  value={formData.operatingHours.open}
                  onChange={(e) => setFormData({
                    ...formData, 
                    operatingHours: {...formData.operatingHours, open: e.target.value}
                  })}
                  className="border-slate-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-time">Closing Time</Label>
                <Input
                  id="close-time"
                  type="time"
                  value={formData.operatingHours.close}
                  onChange={(e) => setFormData({
                    ...formData, 
                    operatingHours: {...formData.operatingHours, close: e.target.value}
                  })}
                  className="border-slate-200 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Person *</Label>
                <Input
                  id="contact"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                  placeholder="Contact person name"
                  className="border-slate-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+254 xxx xxx xxx"
                  className="border-slate-200 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="contact@email.com"
                className="border-slate-200 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional details about this collection point"
                className="border-slate-200 focus:border-blue-500 resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateDialogOpen(false)
                setIsEditDialogOpen(false)
                setEditingPoint(null)
                resetFormData()
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={isCreateDialogOpen ? handleCreate : handleUpdate}
              disabled={!formData.name || !formData.address || !formData.contactPerson || !formData.phone}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreateDialogOpen ? "Create Collection Point" : "Update Collection Point"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection Point</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPoint?.name}"? This action cannot be undone.
              {deletingPoint?.assignedVehicles && deletingPoint.assignedVehicles > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Warning: This collection point has {deletingPoint.assignedVehicles} assigned vehicles.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Collection Point
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}