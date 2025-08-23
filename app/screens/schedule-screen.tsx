"use client"

import { useState, useEffect, useMemo } from "react"
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { 
  Plus, 
  Filter, 
  RefreshCw,
  AlertCircle,
  Check,
  X,
  MapPin,
  User,
  Package,
  Phone,
  Clock,
  DollarSign,
  FileText,
  ChevronLeft,
  ChevronRight,
  Navigation
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeliveryService } from "@/lib/services/deliveries"
import { RouteService } from "@/lib/services/routes"
import { useToast } from "@/hooks/use-toast"

// Setup the localizer for React Big Calendar
const localizer = momentLocalizer(moment)

// Define custom event types for the calendar
interface CalendarEvent {
  id: number
  title: string
  start: Date
  end: Date
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  location: string
  customer_name: string
  item: string
  phone: string
  estimated_value?: string | null
  weight?: string | null
  notes?: string
  resource?: any
}

export default function ScheduleScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [routes, setRoutes] = useState<any[]>([])
  const [view, setView] = useState<'month' | 'week' | 'day'>('week')
  const [date, setDate] = useState(new Date())
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [unscheduledDeliveries, setUnscheduledDeliveries] = useState<any[]>([])
  const [activeRoutes, setActiveRoutes] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    customer_name: "",
    location: "",
    item: "",
    estimated_value: "",
    weight: "",
    phone: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
    notes: ""
  })
  
  const { toast } = useToast()

  // Load deliveries and routes
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Load data with proper error handling for each service
      const deliveriesPromise = DeliveryService.getDeliveriesForCalendar().catch(err => {
        console.warn('Error loading calendar deliveries:', err)
        return []
      })
      
      const routesPromise = RouteService.getAllRoutes().catch(err => {
        console.warn('Error loading routes:', err)
        return []
      })
      
      const unscheduledPromise = DeliveryService.getDeliveriesByStatus('pending').catch(err => {
        console.warn('Error loading unscheduled deliveries:', err)
        return []
      })
      
      const activeRoutesPromise = RouteService.getTodaysActiveRoutes().catch(err => {
        console.warn('Error loading active routes:', err)
        return []
      })
      
      const [deliveriesData, routesData, unscheduledData, activeRoutesData] = await Promise.all([
        deliveriesPromise,
        routesPromise,
        unscheduledPromise,
        activeRoutesPromise
      ])
      
      setEvents(deliveriesData)
      setRoutes(routesData)
      setUnscheduledDeliveries(unscheduledData)
      setActiveRoutes(activeRoutesData)
    } catch (err) {
      console.error('Error loading calendar data:', err)
      setError('Failed to load calendar data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Handle slot selection (clicking on calendar to create new delivery)
  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    const selectedDate = moment(start).format('YYYY-MM-DD')
    const startTime = moment(start).format('HH:mm')
    const endTime = moment(end).format('HH:mm')
    
    setFormData(prev => ({
      ...prev,
      scheduled_date: selectedDate,
      start_time: startTime,
      end_time: endTime
    }))
    
    setIsCreateDialogOpen(true)
  }

  // Handle event selection (clicking on existing delivery)
  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsEventDetailOpen(true)
  }

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      customer_name: "",
      location: "",
      item: "",
      estimated_value: "",
      weight: "",
      phone: "",
      scheduled_date: "",
      start_time: "",
      end_time: "",
      notes: ""
    })
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await DeliveryService.createDeliveryForCalendar({
        customer_name: formData.customer_name,
        location: formData.location,
        item: formData.item,
        estimated_value: formData.estimated_value || null,
        weight: formData.weight || null,
        phone: formData.phone,
        scheduled_date: formData.scheduled_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || undefined,
        status: 'pending'
      })
      
      resetForm()
      setIsCreateDialogOpen(false)
      await loadData()
      
      toast({
        title: "Success",
        description: "Delivery scheduled successfully!",
      })
      
    } catch (error) {
      console.error('Error creating delivery:', error)
      toast({
        title: "Error",
        description: "Failed to schedule delivery. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delivery approval
  const handleApproveDelivery = async (deliveryId: number) => {
    try {
      await DeliveryService.approveDelivery(deliveryId)
      await loadData()
      setIsEventDetailOpen(false)
      
      toast({
        title: "Success",
        description: "Delivery approved successfully!",
      })
    } catch (error) {
      console.error('Error approving delivery:', error)
      toast({
        title: "Error",
        description: "Failed to approve delivery. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle delivery rejection
  const handleRejectDelivery = async (deliveryId: number) => {
    try {
      await DeliveryService.rejectDelivery(deliveryId, "Rejected by manager")
      await loadData()
      setIsEventDetailOpen(false)
      
      toast({
        title: "Success",
        description: "Delivery rejected successfully.",
      })
    } catch (error) {
      console.error('Error rejecting delivery:', error)
      toast({
        title: "Error",
        description: "Failed to reject delivery. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Custom event style function for color coding
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#e5e7eb' // Default gray
    let borderColor = '#9ca3af'
    
    switch (event.status) {
      case 'pending':
        backgroundColor = '#fef3c7' // Yellow
        borderColor = '#f59e0b'
        break
      case 'in-progress':
        backgroundColor = '#d1fae5' // Green (approved/in-progress)
        borderColor = '#10b981'
        break
      case 'completed':
        backgroundColor = '#e0f2fe' // Light blue
        borderColor = '#0288d1'
        break
      case 'failed':
        backgroundColor = '#fee2e2' // Red
        borderColor = '#ef4444'
        break
    }
    
    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '4px',
        color: '#1f2937',
        fontSize: '12px',
        fontWeight: '500'
      }
    }
  }

  // Get current time for displaying overdue deliveries
  const now = new Date()

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${showSidePanel ? 'mr-80' : ''}`}>
        <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-gray-900">Schedule</h1>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {events.length} deliveries
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setShowSidePanel(!showSidePanel)}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
          >
            <Filter className="h-4 w-4 mr-2" />
            {showSidePanel ? 'Hide Panel' : 'Show Panel'}
          </Button>
          <Button 
            variant="outline" 
            onClick={loadData}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Delivery
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {events.filter(e => e.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-semibold text-green-600">
                  {events.filter(e => e.status === 'in-progress').length}
                </p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {events.filter(e => e.status === 'completed').length}
                </p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-semibold text-red-600">
                  {events.filter(e => e.status === 'failed').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading calendar</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button 
            onClick={loadData}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Calendar */}
      {!isLoading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            view={view}
            onView={(newView: any) => setView(newView as 'month' | 'week' | 'day')}
            date={date}
            onNavigate={(newDate: any) => setDate(newDate)}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day']}
            step={30}
            showMultiDayTimes
            popup
            dayLayoutAlgorithm="no-overlap"
            messages={{
              next: "Next",
              previous: "Previous",
              today: "Today",
              month: "Month",
              week: "Week",
              day: "Day"
            }}
          />
        </div>
      )}

      {/* Create Delivery Modal */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Schedule New Delivery</DialogTitle>
            <DialogDescription>
              Create a new delivery that will require approval before being added to routes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="customer_name" className="text-gray-700">
                Customer Name *
              </Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange("customer_name", e.target.value)}
                placeholder="John Doe"
                className="bg-white border-gray-300"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="location" className="text-gray-700">
                Location *
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="123 Main Street, Nairobi"
                className="bg-white border-gray-300"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item" className="text-gray-700">
                  Item *
                </Label>
                <Input
                  id="item"
                  value={formData.item}
                  onChange={(e) => handleInputChange("item", e.target.value)}
                  placeholder="Tomatoes"
                  className="bg-white border-gray-300"
                  required
                />
              </div>
              <div>
                <Label htmlFor="weight" className="text-gray-700">
                  Weight
                </Label>
                <Input
                  id="weight"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  placeholder="5kg"
                  className="bg-white border-gray-300"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimated_value" className="text-gray-700">
                  Estimated Value
                </Label>
                <Input
                  id="estimated_value"
                  value={formData.estimated_value}
                  onChange={(e) => handleInputChange("estimated_value", e.target.value)}
                  placeholder="KSh 2,500"
                  className="bg-white border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-gray-700">
                  Phone *
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+254712345678"
                  className="bg-white border-gray-300"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="scheduled_date" className="text-gray-700">
                  Date *
                </Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => handleInputChange("scheduled_date", e.target.value)}
                  className="bg-white border-gray-300"
                  required
                />
              </div>
              <div>
                <Label htmlFor="start_time" className="text-gray-700">
                  Start Time *
                </Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange("start_time", e.target.value)}
                  className="bg-white border-gray-300"
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time" className="text-gray-700">
                  End Time *
                </Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange("end_time", e.target.value)}
                  className="bg-white border-gray-300"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes" className="text-gray-700">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Special delivery instructions..."
                className="bg-white border-gray-300"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  setIsCreateDialogOpen(false)
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Scheduling..." : "Schedule Delivery"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event Detail Modal */}
      <Dialog open={isEventDetailOpen} onOpenChange={setIsEventDetailOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delivery Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{selectedEvent.customer_name}</h3>
                <Badge 
                  className={
                    selectedEvent.status === 'pending' 
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      : selectedEvent.status === 'in-progress'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : selectedEvent.status === 'completed'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-red-100 text-red-800 border-red-200'
                  }
                >
                  {selectedEvent.status}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Package className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{selectedEvent.item}</span>
                  {selectedEvent.weight && <span className="ml-2 text-gray-500">({selectedEvent.weight})</span>}
                </div>
                
                <div className="flex items-center text-sm">
                  <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{selectedEvent.location}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{selectedEvent.phone}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-2 text-gray-500" />
                  <span>
                    {moment(selectedEvent.start).format('MMM D, YYYY h:mm A')} - {moment(selectedEvent.end).format('h:mm A')}
                  </span>
                </div>
                
                {selectedEvent.estimated_value && (
                  <div className="flex items-center text-sm">
                    <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{selectedEvent.estimated_value}</span>
                  </div>
                )}
                
                {selectedEvent.notes && (
                  <div className="flex items-start text-sm">
                    <FileText className="h-4 w-4 mr-2 mt-0.5 text-gray-500" />
                    <span>{selectedEvent.notes}</span>
                  </div>
                )}
              </div>
              
              {/* Action buttons for pending deliveries */}
              {selectedEvent.status === 'pending' && (
                <div className="flex justify-between space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleRejectDelivery(selectedEvent.id)}
                    className="border-red-300 text-red-700 hover:bg-red-50 bg-white flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApproveDelivery(selectedEvent.id)}
                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              )}
              
              {/* Show status for non-pending deliveries */}
              {selectedEvent.status !== 'pending' && (
                <div className="pt-4">
                  <p className="text-sm text-gray-600">
                    {selectedEvent.status === 'in-progress' && 'This delivery has been approved and assigned to a route.'}
                    {selectedEvent.status === 'completed' && 'This delivery has been completed successfully.'}
                    {selectedEvent.status === 'failed' && 'This delivery was rejected or failed.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>

      {/* Side Panel */}
      {showSidePanel && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Delivery Dashboard</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidePanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Unscheduled Deliveries Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Pending Approval</h3>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {unscheduledDeliveries.length}
                </Badge>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unscheduledDeliveries.map((delivery) => (
                  <Card key={delivery.id} className="p-3 hover:shadow-sm transition-shadow cursor-pointer">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900">
                          {delivery.customer_name}
                        </span>
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          {delivery.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div className="flex items-center mb-1">
                          <Package className="h-3 w-3 mr-1" />
                          {delivery.item}
                        </div>
                        <div className="flex items-center mb-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {delivery.location}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {delivery.drop_time}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {unscheduledDeliveries.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No pending deliveries</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Routes Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Today's Routes</h3>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {activeRoutes.length}
                </Badge>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeRoutes.map((route) => (
                  <Card key={route.id} className="p-3 hover:shadow-sm transition-shadow">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900">
                          {route.name}
                        </span>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Active
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div className="flex items-center mb-1">
                          <User className="h-3 w-3 mr-1" />
                          {route.driver?.name || 'Unassigned'}
                        </div>
                        <div className="flex items-center mb-1">
                          <Package className="h-3 w-3 mr-1" />
                          {Array.isArray(route.deliveries) ? route.deliveries.length : 0} deliveries
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {route.estimated_duration || 60} min
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {activeRoutes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Navigation className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No active routes today</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Delivery
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={loadData}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
