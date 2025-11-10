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
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { CollectionPointService, type CollectionPoint } from '@/lib/services/collection-points'

// Validation schema for collection point form
const collectionPointSchema = Yup.object({
  name: Yup.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .required('Name is required'),
  address: Yup.string()
    .min(1, 'Address is required')
    .max(200, 'Address too long')
    .required('Address is required'),
  type: Yup.string()
    .oneOf(['warehouse', 'depot', 'pickup_point', 'hub'])
    .required('Type is required'),
  capacity: Yup.number()
    .min(1, 'Capacity must be at least 1')
    .max(10000, 'Capacity too large')
    .required('Capacity is required'),
  openingHours: Yup.string()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format')
    .required('Opening time is required'),
  closingHours: Yup.string()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format')
    .required('Closing time is required'),
  contactPerson: Yup.string()
    .min(1, 'Contact person is required')
    .max(100, 'Name too long')
    .required('Contact person is required'),
  phone: Yup.string()
    .min(1, 'Phone is required')
    .max(20, 'Phone too long')
    .required('Phone is required'),
  email: Yup.string()
    .email('Invalid email')
    .optional(),
  description: Yup.string()
    .max(500, 'Description too long')
    .optional()
})

export default function CollectionPointsScreen() {
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<CollectionPoint | null>(null)
  const [deletingPoint, setDeletingPoint] = useState<CollectionPoint | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load collection points on component mount
  useEffect(() => {
    loadCollectionPoints()
  }, [])

  // Handle filter changes
  useEffect(() => {
    const filters = {
      type: selectedType !== 'all' ? selectedType : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      search: searchTerm || undefined
    }
    
    const timeoutId = setTimeout(() => {
      loadCollectionPoints(filters)
    }, 300) // Debounce search
    
    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedType, selectedStatus])

  // Load collection points from API
  const loadCollectionPoints = async (filters?: { type?: string; status?: string; search?: string }) => {
    try {
      setLoading(true)
      setError(null)
      const points = await CollectionPointService.getAllCollectionPoints(filters)
      setCollectionPoints(points)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection points')
      console.error('Error loading collection points:', err)
    } finally {
      setLoading(false)
    }
  }

  // Formik form for create/edit
  const formik = useFormik({
    initialValues: {
      name: "",
      address: "",
      type: "warehouse" as CollectionPoint['type'],
      capacity: 0,
      openingHours: "",
      closingHours: "",
      contactPerson: "",
      phone: "",
      email: "",
      description: ""
    },
    validationSchema: collectionPointSchema,
    validateOnMount: true,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        setSubmitting(true)
        
        // Ensure capacity is a number
        const sanitizedValues = {
          ...values,
          capacity: typeof values.capacity === 'string' ? Number(values.capacity) : values.capacity
        }
        
        if (editingPoint) {
          // Update existing collection point
          await CollectionPointService.updateCollectionPoint(editingPoint.id, sanitizedValues)
          setIsEditDialogOpen(false)
          setEditingPoint(null)
        } else {
          // Create new collection point - server will add organization_id, created_by, updated_by
          const createData = {
            ...sanitizedValues,
            assignmentVehicles: 0,
            status: "active" as const
          }
          await CollectionPointService.createCollectionPoint(createData)
          setIsCreateDialogOpen(false)
        }
        // Reload collection points
        await loadCollectionPoints()
        formik.resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save collection point')
        console.error('Error saving collection point:', err)
      } finally {
        setSubmitting(false)
      }
    }
  })

  // Handle create collection point
  const handleCreate = () => {
    formik.resetForm()
    setIsCreateDialogOpen(true)
  }

  // Handle edit collection point
  const handleEdit = (point: CollectionPoint) => {
    setEditingPoint(point)
    formik.setValues({
      name: point.name,
      address: point.address,
      type: point.type,
      capacity: Number(point.capacity), // Ensure it's a number
      openingHours: point.openingHours,
      closingHours: point.closingHours,
      contactPerson: point.contactPerson,
      phone: point.phone,
      email: point.email || "",
      description: point.description || ""
    })
    setIsEditDialogOpen(true)
  }

  // Handle delete collection point
  const handleDelete = (point: CollectionPoint) => {
    setDeletingPoint(point)
    setIsDeleteDialogOpen(true)
  }

  // Confirm delete
  const confirmDelete = async () => {
    if (!deletingPoint) return

    try {
      await CollectionPointService.deleteCollectionPoint(deletingPoint.id)
      await loadCollectionPoints()
      setIsDeleteDialogOpen(false)
      setDeletingPoint(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete collection point')
      console.error('Error deleting collection point:', err)
    }
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

  // Calculate stats
  const stats = {
    total: collectionPoints.length,
    active: collectionPoints.filter(p => p.status === 'active').length,
    inactive: collectionPoints.filter(p => p.status === 'inactive').length,
    maintenance: collectionPoints.filter(p => p.status === 'maintenance').length,
    totalVehicles: collectionPoints.reduce((sum, p) => sum + p.assignmentVehicles, 0)
  }

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
      case 'pickup_point':
        return <Bike className="h-4 w-4" />
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 truncate">Collection Points</h1>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">Manage pickup and delivery starting points</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Collection Point</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search collection points..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
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
                <SelectItem value="pickup_point">Pickup Point</SelectItem>
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
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Points</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-black">{stats.total}</p>
                  </div>
                  <MapPin className="h-6 w-6 sm:h-7 sm:w-7 lg:h-6 lg:w-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Active</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-black">{stats.active}</p>
                  </div>
                  <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 lg:h-6 lg:w-6 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Maintenance</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-black">{stats.maintenance}</p>
                  </div>
                  <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 lg:h-6 lg:w-6 text-amber-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Vehicles</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-black">{stats.totalVehicles}</p>
                  </div>
                  <Car className="h-6 w-6 sm:h-7 sm:w-7 lg:h-7 lg:w-7 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Collection Points List */}
        <div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500">Loading collection points...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-red-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">Error loading collection points</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">{error}</p>
              <Button 
                onClick={loadCollectionPoints}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : filteredPoints.length === 0 ? (
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
                <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Collection Point
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredPoints.map((point) => (
              <Card key={point.id} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        {getTypeIcon(point.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-semibold text-slate-900 truncate" title={point.name}>{point.name}</CardTitle>
                        <p className="text-sm text-slate-500 capitalize">{point.type.replace('-', ' ')}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusBadge(point.status)} flex-shrink-0`}>
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
                        {point.openingHours} - {point.closingHours}
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
                      <span>Vehicles: {point.assignmentVehicles}</span>
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
          formik.resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span>{isCreateDialogOpen ? "Add New Collection Point" : "Edit Collection Point"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={formik.handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Collection point name"
                  className={`border-slate-200 focus:border-blue-500 ${
                    formik.touched.name && formik.errors.name ? 'border-red-500' : ''
                  }`}
                />
                {formik.touched.name && formik.errors.name && (
                  <p className="text-sm text-red-500">{formik.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select 
                  value={formik.values.type} 
                  onValueChange={(value) => formik.setFieldValue('type', value)}
                >
                  <SelectTrigger className="border-slate-200 focus:border-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="depot">Depot</SelectItem>
                    <SelectItem value="hub">Hub</SelectItem>
                    <SelectItem value="pickup_point">Pickup Point</SelectItem>
                  </SelectContent>
                </Select>
                {formik.touched.type && formik.errors.type && (
                  <p className="text-sm text-red-500">{formik.errors.type}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                name="address"
                value={formik.values.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Full address"
                className={`border-slate-200 focus:border-blue-500 ${
                  formik.touched.address && formik.errors.address ? 'border-red-500' : ''
                }`}
              />
              {formik.touched.address && formik.errors.address && (
                <p className="text-sm text-red-500">{formik.errors.address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  value={formik.values.capacity}
                  onChange={(e) => formik.setFieldValue('capacity', Number(e.target.value))}
                  onBlur={formik.handleBlur}
                  placeholder="Max capacity"
                  className={`border-slate-200 focus:border-blue-500 ${
                    formik.touched.capacity && formik.errors.capacity ? 'border-red-500' : ''
                  }`}
                />
                {formik.touched.capacity && formik.errors.capacity && (
                  <p className="text-sm text-red-500">{formik.errors.capacity}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingHours">Opening Time *</Label>
                <Input
                  id="openingHours"
                  name="openingHours"
                  type="time"
                  value={formik.values.openingHours}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={`border-slate-200 focus:border-blue-500 ${
                    formik.touched.openingHours && formik.errors.openingHours ? 'border-red-500' : ''
                  }`}
                />
                {formik.touched.openingHours && formik.errors.openingHours && (
                  <p className="text-sm text-red-500">{formik.errors.openingHours}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="closingHours">Closing Time *</Label>
                <Input
                  id="closingHours"
                  name="closingHours"
                  type="time"
                  value={formik.values.closingHours}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={`border-slate-200 focus:border-blue-500 ${
                    formik.touched.closingHours && formik.errors.closingHours ? 'border-red-500' : ''
                  }`}
                />
                {formik.touched.closingHours && formik.errors.closingHours && (
                  <p className="text-sm text-red-500">{formik.errors.closingHours}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person *</Label>
                <Input
                  id="contactPerson"
                  name="contactPerson"
                  value={formik.values.contactPerson}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Contact person name"
                  className={`border-slate-200 focus:border-blue-500 ${
                    formik.touched.contactPerson && formik.errors.contactPerson ? 'border-red-500' : ''
                  }`}
                />
                {formik.touched.contactPerson && formik.errors.contactPerson && (
                  <p className="text-sm text-red-500">{formik.errors.contactPerson}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formik.values.phone}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="+254 xxx xxx xxx"
                  className={`border-slate-200 focus:border-blue-500 ${
                    formik.touched.phone && formik.errors.phone ? 'border-red-500' : ''
                  }`}
                />
                {formik.touched.phone && formik.errors.phone && (
                  <p className="text-sm text-red-500">{formik.errors.phone}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="contact@email.com"
                className={`border-slate-200 focus:border-blue-500 ${
                  formik.touched.email && formik.errors.email ? 'border-red-500' : ''
                }`}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="text-sm text-red-500">{formik.errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                name="description"
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Additional details about this collection point"
                className={`border-slate-200 focus:border-blue-500 resize-none ${
                  formik.touched.description && formik.errors.description ? 'border-red-500' : ''
                }`}
                rows={3}
              />
              {formik.touched.description && formik.errors.description && (
                <p className="text-sm text-red-500">{formik.errors.description}</p>
              )}
            </div>

            <DialogFooter>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  setIsEditDialogOpen(false)
                  setEditingPoint(null)
                  formik.resetForm()
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={submitting || (Object.keys(formik.errors).length > 0 && formik.submitCount > 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  isCreateDialogOpen ? "Create Collection Point" : "Update Collection Point"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection Point</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPoint?.name}"? This action cannot be undone.
              {deletingPoint?.assignmentVehicles && deletingPoint.assignmentVehicles > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Warning: This collection point has {deletingPoint.assignmentVehicles} assigned vehicles.
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
    </div>
  )
}