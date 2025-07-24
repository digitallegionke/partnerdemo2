"use client"

import { BarChart3, TrendingUp, Timer, Package, Truck, MapPin, ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import RoutesTest from "@/components/routes-test"

export default function AnalyticsScreen() {
  // placeholder KPI data
  const kpis = [
    { label: "Avg. Delivery Time", value: "32 min", icon: Timer, trend: "+4%" },
    { label: "On-Time Rate", value: "92%", icon: TrendingUp, trend: "+1.2%" },
    { label: "Daily Deliveries", value: "248", icon: Package, trend: "+9" },
    { label: "Active Drivers", value: "22", icon: Truck, trend: "-1" },
    { label: "Avg. Route Length", value: "38 km", icon: MapPin, trend: "-3 km" },
  ]

  return (
    <div className="p-6 bg-white space-y-6">
      {/* Temporary Routes Test */}
      <div className="flex justify-start">
        <RoutesTest />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map(({ label, value, icon: Icon, trend }) => (
          <Card key={label} className="bg-white border border-gray-200">
            <CardContent className="p-4 flex items-center space-x-4">
              <div className="p-2 rounded-md bg-blue-50 text-blue-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-xl font-semibold text-gray-900">{value}</p>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                {trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder for charts */}
      <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-gray-300 text-gray-400">
        <BarChart3 className="h-8 w-8 mr-2" />
        Charts coming soon…
      </div>
    </div>
  )
}
