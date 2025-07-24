"use client"

import { useState, useEffect } from "react"
import { 
  Clock, 
  Plus, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  User, 
  Package, 
  Edit, 
  Trash2,
  RefreshCw,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScheduleService, type ScheduleWithDetails } from "@/lib/services/schedules"
import { RouteService } from "@/lib/services/routes"
import { DriverService } from "@/lib/services/drivers"
import { useToast } from "@/hooks/use-toast"

// Transform Supabase schedule data to UI format
const transformScheduleForUI = (schedule: ScheduleWithDetails) => {
  const formatTime = (startTime: string, endTime: string) => {
    const formatSingleTime = (timeString: string) => {
      const [hours, minutes] = timeString.split(':')
      const hour24 = parseInt(hours)
      const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24
      const ampm = hour24 >= 12 ? 'PM' : 'AM'
      return `${hour12}:${minutes} ${ampm}`
    }
    
    return `${formatSingleTime(startTime)} - ${formatSingleTime(endTime)}`
  }

  return {
    id: schedule.id,
    title: schedule.title,
    driver: schedule.driver?.name || 'Unassigned',
    time: formatTime(schedule.start_time, schedule.end_time),
    date: schedule.scheduled_date,
    status: schedule.status,
    deliveries: schedule.delivery_count || 0,
    location: schedule.route?.start_location || 'Location TBD',
    priority: schedule.priority,
  }
}

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState("week")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [routes, setRoutes] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: "",
    route_id: "",
    driver_id: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
    priority: "medium",
    notes: ""
  })
  
  const { toast } = useToast()

  // Load schedules from Supabase
  const loadSchedules = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await ScheduleService.getAllSchedules()
      const transformedSchedules = data.map(transformScheduleForUI)
      setSchedules(transformedSchedules)
    } catch (err) {
      console.error('Error loading schedules:', err)
      setError('Failed to load schedules. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Load routes and drivers for the form dropdowns
  const loadFormData = async () => {
    try {
      const [routesData, driversData] = await Promise.all([
        RouteService.getAllRoutes(),
        DriverService.getAllDrivers()
      ])
      setRoutes(routesData)
      setDrivers(driversData)
    } catch (error) {
      console.error('Error loading form data:', error)
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadSchedules()
    loadFormData()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      title: "",
      route_id: "",
      driver_id: "",
      scheduled_date: "",
      start_time: "",
      end_time: "",
      priority: "medium",
      notes: ""
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const scheduleData = {
        title: formData.title,
        route_id: formData.route_id ? parseInt(formData.route_id) : null,
        driver_id: formData.driver_id ? parseInt(formData.driver_id) : null,
        scheduled_date: formData.scheduled_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        priority: formData.priority as 'low' | 'medium' | 'high',
        notes: formData.notes || null,
      }

      await ScheduleService.createSchedule(scheduleData)
      
      resetForm()
      setIsAddDialogOpen(false)
      await loadSchedules()
      
      toast({
        title: "Success",
        description: "Schedule created successfully!",
      })
      
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast({
        title: "Error",
        description: "Failed to create schedule. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSchedule = async (scheduleId: number) => {
    try {
      await ScheduleService.deleteSchedule(scheduleId)
      await loadSchedules()
      
      toast({
        title: "Success",
        description: "Schedule deleted successfully!",
      })
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast({
        title: "Error",
        description: "Failed to delete schedule. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "cancelled":
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

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(currentDate.getDate() - day)

    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      weekDays.push(date)
    }
    return weekDays
  }

  const getScheduleForDate = (date: Date) => {
    const dateString = date.toISOString().split("T")[0]
    return schedules.filter((item) => item.date === dateString)
  }

  return (
    <div className="p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth(-1)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth(1)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-32 bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            onClick={loadSchedules}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Delivery
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-gray-200 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Schedule New Delivery</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-gray-700">
                    Title *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Delivery title"
                    className="bg-white border-gray-300"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="route" className="text-gray-700">
                    Route (Optional)
                  </Label>
                  <Select
                    value={formData.route_id}
                    onValueChange={(value) => handleInputChange("route_id", value)}
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="">No route assigned</SelectItem>
                      {routes.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          {route.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="driver" className="text-gray-700">
                    Driver (Optional)
                  </Label>
                  <Select
                    value={formData.driver_id}
                    onValueChange={(value) => handleInputChange("driver_id", value)}
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="">Unassigned</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id.toString()}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date" className="text-gray-700">
                      Date *
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => handleInputChange("scheduled_date", e.target.value)}
                      className="bg-white border-gray-300"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority" className="text-gray-700">
                      Priority
                    </Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => handleInputChange("priority", value)}
                    >
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700">Time Range *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => handleInputChange("start_time", e.target.value)}
                      className="bg-white border-gray-300"
                      placeholder="Start time"
                      required
                    />
                    <Input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => handleInputChange("end_time", e.target.value)}
                      className="bg-white border-gray-300"
                      placeholder="End time"
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
                    placeholder="Additional notes"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div className="flex justify-end space-x-2">
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
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating..." : "Schedule"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading schedules...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading schedules</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button 
            onClick={loadSchedules}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Calendar Views */}
      {!isLoading && !error && (
        <>
          {/* Week View */}
          {viewMode === "week" && (
            <div className="grid grid-cols-7 gap-4">
              {getWeekDays().map((date, index) => (
                <div key={index} className="min-h-[400px]">
                  <div className="text-center mb-4">
                    <div className="text-sm text-gray-500">{daysOfWeek[date.getDay()]}</div>
                    <div
                      className={`text-lg font-semibold ${
                        date.toDateString() === new Date().toDateString() ? "text-blue-600" : "text-gray-900"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {getScheduleForDate(date).map((item) => (
                      <Card
                        key={item.id}
                        className="bg-white border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer"
                      >
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge className={getStatusColor(item.status)} variant="outline">
                                {item.status}
                              </Badge>
                              <Badge className={getPriorityColor(item.priority)} variant="outline">
                                {item.priority}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-gray-900 text-sm leading-tight">{item.title}</h4>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {item.time}
                              </div>
                              <div className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {item.driver}
                              </div>
                              <div className="flex items-center">
                                <Package className="h-3 w-3 mr-1" />
                                {item.deliveries} deliveries
                              </div>
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                {item.location}
                              </div>
                            </div>
                            <div className="flex justify-end space-x-1 pt-2">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-gray-400 hover:text-red-600"
                                onClick={() => handleDeleteSchedule(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
              </div>
              <div className="space-y-4">
                {getScheduleForDate(currentDate).map((item) => (
                  <Card key={item.id} className="bg-white border border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h4 className="font-semibold text-gray-900">{item.title}</h4>
                            <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                            <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-900">{item.time}</span>
                            </div>
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-900">{item.driver}</span>
                            </div>
                            <div className="flex items-center">
                              <Package className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-900">{item.deliveries} deliveries</span>
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-900">{item.location}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-red-600 hover:bg-red-50 bg-white"
                            onClick={() => handleDeleteSchedule(item.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Empty State for Day View */}
              {getScheduleForDate(currentDate).length === 0 && (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules for this day</h3>
                  <p className="text-gray-500 mb-4">Create a new schedule to get started</p>
                  <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Delivery
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
