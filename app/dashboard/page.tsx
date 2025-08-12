"use client"

import { useState, useEffect } from "react"
import {
  Search,
  Menu,
  Settings,
  Bell,
  Route,
  Users,
  Package,
  Navigation,
  Calendar,
  BarChart3,
  UserPlus,
  HelpCircle,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import FeatureTour, { useFeatureTour } from "@/components/feature-tour"

// Import all screen components
import RoutesScreen from "../screens/routes-screen"
import DeliveriesScreen from "../screens/deliveries-screen"
import DriversScreen from "../screens/drivers-screen"
import OptimizeScreen from "../screens/optimize-screen"
import ScheduleScreen from "../screens/schedule-screen"
import AnalyticsScreen from "../screens/analytics-screen"
import SettingsScreen from "../screens/settings-screen"
import AssignDriversScreen from "../screens/assign-drivers-screen"
import RouteMapScreen from "../screens/route-map-screen"
import CollectionPointsScreen from "../screens/collection-points-screen"

const sidebarItems = [
  { id: "routes", icon: Route, label: "Routes", count: 8 },
  { id: "deliveries", icon: Package, label: "Deliveries", count: 24 },
  { id: "drivers", icon: Users, label: "Drivers", count: 12 },
  { id: "collection-points", icon: MapPin, label: "Collection Points", count: 4 },
  { id: "optimize", icon: Navigation, label: "Optimize" },
  { id: "schedule", icon: Calendar, label: "Schedule" },
  { id: "analytics", icon: BarChart3, label: "Analytics" },
  { id: "assign", icon: UserPlus, label: "Assign Drivers" },
  { id: "settings", icon: Settings, label: "Settings" },
]

export default function DashboardPage() {
  const [activeScreen, setActiveScreen] = useState("routes")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<any>(null)
  const [routeDeliveries, setRouteDeliveries] = useState<any[]>([])
  const [isFirstTime, setIsFirstTime] = useState(false)
  
  const { showTour, hasCompletedTour, startTour, closeTour, completeTour } = useFeatureTour()

  // Check if this is a first-time user
  useEffect(() => {
    const hasVisited = localStorage.getItem('roundi-has-visited')
    if (!hasVisited) {
      setIsFirstTime(true)
      localStorage.setItem('roundi-has-visited', 'true')
      
      // Auto-start tour for first-time users after a brief delay
      setTimeout(() => {
        if (!hasCompletedTour) {
          startTour()
        }
      }, 1500)
    }
  }, [hasCompletedTour, startTour])

  const handleViewRouteMap = (route: any, deliveries: any[]) => {
    setSelectedRoute(route)
    setRouteDeliveries(deliveries)
    setActiveScreen("route-map")
  }

  const handleBackToRoutes = () => {
    setActiveScreen("routes")
    setSelectedRoute(null)
    setRouteDeliveries([])
  }

  const handleLogout = () => {
    // Clear any auth state and redirect to login
    localStorage.removeItem('roundi-has-visited')
    localStorage.removeItem('roundi-tour-completed')
    window.location.href = "/"
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case "routes":
        return <RoutesScreen onViewRouteMap={handleViewRouteMap} />
      case "deliveries":
        return <DeliveriesScreen />
      case "drivers":
        return <DriversScreen />
      case "collection-points":
        return <CollectionPointsScreen onBack={() => setActiveScreen("routes")} />
      case "optimize":
        return <OptimizeScreen />
      case "schedule":
        return <ScheduleScreen />
      case "analytics":
        return <AnalyticsScreen />
      case "assign":
        return <AssignDriversScreen />
      case "settings":
        return <SettingsScreen />
      case "route-map":
        return selectedRoute && routeDeliveries ? (
          <RouteMapScreen 
            route={selectedRoute}
            deliveries={routeDeliveries}
            onBack={handleBackToRoutes}
          />
        ) : <RoutesScreen onViewRouteMap={handleViewRouteMap} />
      default:
        return <RoutesScreen onViewRouteMap={handleViewRouteMap} />
    }
  }

  const getScreenTitle = () => {
    const screen = sidebarItems.find((item) => item.id === activeScreen)
    return screen ? screen.label : "Routes"
  }

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Feature Tour */}
      <FeatureTour 
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeTour}
      />

      {/* First-time user welcome banner */}
      {isFirstTime && !hasCompletedTour && !showTour && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold">Welcome to Roundi! 🎉</h3>
                <p className="text-sm text-blue-100">Take a quick tour to learn about your delivery management dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={startTour}
                className="bg-white text-blue-600 border-white hover:bg-blue-50"
              >
                Start Tour
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsFirstTime(false)}
                className="text-white hover:bg-white hover:bg-opacity-10"
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-80"
        } flex flex-col shadow-sm ${isFirstTime && !hasCompletedTour ? 'mt-16' : ''}`}
        id="sidebar"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-gray-900">Roundi</h1>
                <p className="text-sm text-gray-500">Delivery Management</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Button
                key={item.id}
                variant={activeScreen === item.id ? "secondary" : "ghost"}
                onClick={() => setActiveScreen(item.id)}
                className={`w-full justify-start ${sidebarCollapsed ? "px-2" : "px-4"} ${
                  activeScreen === item.id
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                id={`${item.id}-section`}
              >
                <item.icon className="h-5 w-5" />
                {!sidebarCollapsed && (
                  <>
                    <span className="ml-3 flex-1 text-left">{item.label}</span>
                    {item.count && (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                        {item.count}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            ))}
          </div>
        </nav>

        {/* Quick Stats */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">24</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">18</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
            <div className="space-y-2">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
                Quick Actions
              </Button>
              {hasCompletedTour && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={startTour}
                  className="w-full text-xs"
                >
                  <HelpCircle className="w-3 h-3 mr-1" />
                  Take Tour Again
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col bg-white ${isFirstTime && !hasCompletedTour ? 'mt-16' : ''}`}>
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search..."
                  className="pl-10 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-50">
                <Bell className="h-5 w-5" />
              </Button>
              {!sidebarCollapsed && hasCompletedTour && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={startTour}
                  className="text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  title="Take feature tour"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              )}
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" />
                  <AvatarFallback className="bg-gray-100 text-gray-600">DM</AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">David Manager</p>
                  <p className="text-xs text-gray-500">Operations Lead</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Screen Content */}
        <div className="flex-1 overflow-auto">{renderScreen()}</div>
      </div>
    </div>
  )
} 