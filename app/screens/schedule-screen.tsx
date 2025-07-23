"use client"

import { useState } from "react"
import { Clock, Plus, Filter, ChevronLeft, ChevronRight, MapPin, User, Package, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const mockScheduleData = [
  {
    id: 1,
    title: "Morning Deliveries - Route A",
    driver: "James Ochieng",
    time: "08:00 - 12:00",
    date: "2024-01-15",
    status: "scheduled",
    deliveries: 8,
    location: "Nairobi CBD",
    priority: "high",
  },
  {
    id: 2,
    title: "Westlands Circuit",
    driver: "Sarah Muthoni",
    time: "09:00 - 13:00",
    date: "2024-01-15",
    status: "in-progress",
    deliveries: 6,
    location: "Westlands",
    priority: "medium",
  },
  {
    id: 3,
    title: "Afternoon Deliveries - Route B",
    driver: "David Kiprop",
    time: "14:00 - 18:00",
    date: "2024-01-15",
    status: "scheduled",
    deliveries: 5,
    location: "Karen",
    priority: "low",
  },
  {
    id: 4,
    title: "Express Deliveries",
    driver: "Grace Wanjiku",
    time: "10:00 - 14:00",
    date: "2024-01-16",
    status: "scheduled",
    deliveries: 4,
    location: "Thika Road",
    priority: "high",
  },
]

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export default function ScheduleScreen() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState("week")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

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
    return mockScheduleData.filter((item) => item.date === dateString)
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
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-gray-700">
                    Title
                  </Label>
                  <Input id="title" placeholder="Delivery title" className="bg-white border-gray-300" />
                </div>
                <div>
                  <Label htmlFor="driver" className="text-gray-700">
                    Driver
                  </Label>
                  <Select>
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="james">James Ochieng</SelectItem>
                      <SelectItem value="sarah">Sarah Muthoni</SelectItem>
                      <SelectItem value="david">David Kiprop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date" className="text-gray-700">
                      Date
                    </Label>
                    <Input id="date" type="date" className="bg-white border-gray-300" />
                  </div>
                  <div>
                    <Label htmlFor="time" className="text-gray-700">
                      Time
                    </Label>
                    <Input id="time" type="time" className="bg-white border-gray-300" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes" className="text-gray-700">
                    Notes
                  </Label>
                  <Textarea id="notes" placeholder="Additional notes" className="bg-white border-gray-300" />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                  >
                    Cancel
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">Schedule</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar View */}
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
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600">
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
        </div>
      )}
    </div>
  )
}
