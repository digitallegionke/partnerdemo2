"use client";

import { useState, useEffect } from "react";
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import FeatureTour, { useFeatureTour } from "@/components/feature-tour";

// Import all screen components
import RoutesScreen from "../screens/routes-screen";
import DeliveriesScreen from "../screens/deliveries-screen";
import DriversScreen from "../screens/drivers-screen";
import OptimizeScreen from "../screens/optimize-screen";
import ScheduleScreen from "../screens/schedule-screen";
import AnalyticsScreen from "../screens/analytics-screen";
import SettingsScreen from "../screens/settings-screen";
import AssignDriversScreen from "../screens/assign-drivers-screen";
import RouteMapScreen from "../screens/route-map-screen";
import CollectionPointsScreen from "../screens/collection-points-screen";
import UserProfile from "../components/user-profile";
import { RequireAuth } from "@/components/require-auth";
import { DriverService } from "@/lib/services/drivers";
import { DeliveryService } from "@/lib/services/deliveries";
import { RouteService } from "@/lib/services/routes";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [activeScreen, setActiveScreen] = useState("routes");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [routeDeliveries, setRouteDeliveries] = useState<any[]>([]);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [sidebarCount, setSidebarCount] = useState({
    routes: 0,
    deliveries: 0,
    drivers: 0,
    collectionPoints: 0,
  });
  const { showTour, hasCompletedTour, startTour, closeTour, completeTour } =
    useFeatureTour();
  const sidebarStats = async () => {
    const driverStats = await DriverService.getDriverStats();
    const deliveryStats = await DeliveryService.getDeliveryStats();
    const routeStats = await RouteService.getRouteStats();
    setSidebarCount((prev) => ({
      ...prev,
      routes: routeStats.total,
      deliveries: deliveryStats.total,
      drivers: driverStats.total,
    }));
  };
  const sidebarItems = [
    { id: "routes", icon: Route, label: "Routes", count: sidebarCount.routes },
    {
      id: "deliveries",
      icon: Package,
      label: "Deliveries",
      count: sidebarCount.deliveries,
    },
    {
      id: "drivers",
      icon: Users,
      label: "Drivers",
      count: sidebarCount.drivers,
    },
    {
      id: "collection-points",
      icon: MapPin,
      label: "Collection Points",
      count: sidebarCount.collectionPoints,
    },

    // { id: "optimize", icon: Navigation, label: "Optimize" },
    // { id: "schedule", icon: Calendar, label: "Schedule" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    // { id: "assign", icon: UserPlus, label: "Assign Drivers" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];
  useEffect(() => {
    sidebarStats();
  }, []);
  // Check if this is a first-time user
  useEffect(() => {
    const hasVisited = localStorage.getItem("roundi-has-visited");
    if (!hasVisited) {
      setIsFirstTime(true);
      localStorage.setItem("roundi-has-visited", "true");

      // Auto-start tour for first-time users after a brief delay
      setTimeout(() => {
        if (!hasCompletedTour) {
          startTour();
        }
      }, 1500);
    }
  }, [hasCompletedTour, startTour]);

  const handleViewRouteMap = (route: any, deliveries: any[]) => {
    setSelectedRoute(route);
    setRouteDeliveries(deliveries);
    setActiveScreen("route-map");
  };

  const handleBackToRoutes = () => {
    setActiveScreen("routes");
    setSelectedRoute(null);
    setRouteDeliveries([]);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error.message);
      return;
    }
    // localStorage.removeItem("roundi-has-visited");
    // localStorage.removeItem("roundi-tour-completed");
    window.location.href = "/";
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "routes":
        return <RoutesScreen onViewRouteMap={handleViewRouteMap} />;
      case "deliveries":
        return <DeliveriesScreen />;
      case "drivers":
        return <DriversScreen />;
      case "collection-points":
        return (
          <CollectionPointsScreen onBack={() => setActiveScreen("routes")} />
        );

      // case "optimize":
      //   return <OptimizeScreen />;
      // case "schedule":
      //   return <ScheduleScreen />;
      case "analytics":
        return <AnalyticsScreen />;
      // case "assign":
      //   return <AssignDriversScreen />;
      case "settings":
        return <SettingsScreen />;
      case "route-map":
        return selectedRoute && routeDeliveries ? (
          <RouteMapScreen
            route={selectedRoute}
            deliveries={routeDeliveries}
            onBack={handleBackToRoutes}
          />
        ) : (
          <RoutesScreen onViewRouteMap={handleViewRouteMap} />
        );
      default:
        return <RoutesScreen onViewRouteMap={handleViewRouteMap} />;
    }
  };

  const getScreenTitle = () => {
    const screen = sidebarItems.find((item) => item.id === activeScreen);
    return screen ? screen.label : "Routes";
  };
  console.log("selected route", selectedRoute);
  return (
    <RequireAuth>
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
                  <p className="text-sm text-blue-100">
                    Take a quick tour to learn about your delivery management
                    dashboard
                  </p>
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

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Left Sidebar */}
        <div
          className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-sm
        ${isFirstTime && !hasCompletedTour ? "mt-16" : ""}
        lg:relative lg:flex ${sidebarCollapsed ? "lg:w-16" : "lg:w-80"}
        fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out
        ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }
        lg:transform-none`}
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
              {/* Desktop collapse button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              >
                <Menu className="h-5 w-5" />
              </Button>
              {/* Mobile close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              >
                <X className="h-5 w-5" />
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
                  onClick={() => {
                    setActiveScreen(item.id);
                    setMobileMenuOpen(false); // Close mobile menu when item is selected
                  }}
                  className={`w-full justify-start ${
                    sidebarCollapsed ? "px-2" : "px-4"
                  } ${
                    activeScreen === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  id={`${item.id}-section`}
                >
                  <item.icon className="h-5 w-5" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="ml-3 flex-1 text-left">
                        {item.label}
                      </span>
                      {item.count && (
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-600 text-xs"
                        >
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
        <div
          className={`flex-1 flex flex-col bg-white ${
            isFirstTime && !hasCompletedTour ? "mt-16" : ""
          }`}
        >
          {/* Top Bar */}
          <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                {/* Mobile Screen Title */}
                <div className="lg:hidden">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {getScreenTitle()}
                  </h2>
                </div>
                <div className="relative flex-1 max-w-md hidden sm:block">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search..."
                    className="pl-10 bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                >
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
                <UserProfile />
              </div>
            </div>
          </div>

          {/* Screen Content */}

          <div className="flex-1 overflow-auto">{renderScreen()}</div>
        </div>
      </div>
    </RequireAuth>
  );
}
