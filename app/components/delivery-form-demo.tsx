"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PlaceAutocomplete from "./place-autocomplete"
import MapComponent from "./map-component"
import { RouteService } from "@/lib/services/routes"
import { DeliveryService } from "@/lib/services/deliveries"

interface DeliveryFormData {
  customerName: string
  phone: string
  item: string
  deliveryAddress: string
  coordinates: { lat: number; lon: number } | null
  routeId: string | null
}

interface LocalDelivery {
  id: number
  customerName: string
  location: string
  coordinates: [number, number]
  item: string
  dropTime: string
  status: string
  phone: string
  routeId?: number | null
  routeName?: string
}

interface RouteOption {
  id: number
  name: string
  status: string
  driverName?: string
}

export default function DeliveryFormDemo() {
  const [formData, setFormData] = useState<DeliveryFormData>({
    customerName: "",
    phone: "",
    item: "",
    deliveryAddress: "",
    coordinates: null,
    routeId: null
  })

  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [deliveries, setDeliveries] = useState<LocalDelivery[]>([
    {
      id: 1,
      customerName: "John Kamau",
      location: "Westlands, Nairobi",
      coordinates: [-1.2635, 36.8078],
      item: "Tomatoes - 50kg",
      dropTime: "10:00 AM",
      status: "pending",
      phone: "+254712345678",
      routeId: 1,
      routeName: "Nairobi Central Route"
    },
    {
      id: 2,
      customerName: "Mary Wanjiku",
      location: "Karen, Nairobi",
      coordinates: [-1.3197, 36.7085],
      item: "Maize - 100kg",
      dropTime: "11:30 AM",
      status: "in-progress",
      phone: "+254723456789",
      routeId: 2,
      routeName: "Westlands Circuit"
    }
  ])

  const [selectedDelivery, setSelectedDelivery] = useState<LocalDelivery>(deliveries[0])

  // Fetch available routes on component mount
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setLoading(true)
        const routesData = await RouteService.getAllRoutes()
        const routeOptions = routesData.map(route => ({
          id: route.id,
          name: route.name,
          status: route.status,
          driverName: route.driver?.name
        }))
        setRoutes(routeOptions)
      } catch (error) {
        console.error('Error fetching routes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRoutes()
  }, [])

  // Handle place selection from autocomplete
  const handlePlaceSelect = (place: { address: string; lat: number; lon: number }) => {
    setFormData(prev => ({
      ...prev,
      deliveryAddress: place.address,
      coordinates: place.lat && place.lon ? { lat: place.lat, lon: place.lon } : null
    }))
  }

  // Handle location selection from map
  const handleMapLocationSelect = (location: { lat: number; lng: number; address: string }) => {
    setFormData(prev => ({
      ...prev,
      deliveryAddress: location.address,
      coordinates: { lat: location.lat, lon: location.lng }
    }))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.coordinates) {
      alert("Please select a delivery location")
      return
    }

    if (!formData.customerName || !formData.phone || !formData.item) {
      alert("Please fill in all required fields")
      return
    }

    try {
      setSubmitting(true)

      // Create delivery in database
      const deliveryData = {
        customer_name: formData.customerName,
        location: formData.deliveryAddress,
        coordinates: [formData.coordinates.lat, formData.coordinates.lon] as [number, number],
        item: formData.item,
        phone: formData.phone,
        drop_time: "12:00", // Default time, could be made configurable
        status: 'pending' as const
      }

      const createdDelivery = await DeliveryService.createDelivery(deliveryData)

      // If route is selected, assign delivery to route
      if (formData.routeId) {
        await RouteService.addDeliveryToRoute(createdDelivery.id, parseInt(formData.routeId))
      }

      // Create local delivery object for immediate UI update
      const selectedRoute = routes.find(r => r.id.toString() === formData.routeId)
      const newDelivery: LocalDelivery = {
        id: createdDelivery.id,
        customerName: formData.customerName,
        location: formData.deliveryAddress,
        coordinates: [formData.coordinates.lat, formData.coordinates.lon],
        item: formData.item,
        dropTime: "12:00 PM",
        status: formData.routeId ? "in-progress" : "pending",
        phone: formData.phone,
        routeId: formData.routeId ? parseInt(formData.routeId) : null,
        routeName: selectedRoute?.name
      }

      setDeliveries(prev => [...prev, newDelivery])
      
      // Reset form
      setFormData({
        customerName: "",
        phone: "",
        item: "",
        deliveryAddress: "",
        coordinates: null,
        routeId: null
      })

      alert("Delivery added successfully!")
    } catch (error) {
      console.error('Error creating delivery:', error)
      alert("Error adding delivery. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Place Autocomplete Demo</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  placeholder="Enter customer name"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="item">Item *</Label>
                <Input
                  id="item"
                  value={formData.item}
                  onChange={(e) => setFormData(prev => ({ ...prev, item: e.target.value }))}
                  placeholder="e.g., Tomatoes - 50kg"
                  required
                />
              </div>

              <div>
                <Label htmlFor="deliveryLocation">Delivery Location *</Label>
                <PlaceAutocomplete
                  value={formData.deliveryAddress}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Enter delivery address"
                  className="mt-1"
                />
                {formData.coordinates && (
                  <p className="text-sm text-gray-500 mt-1">
                    Coordinates: {formData.coordinates.lat.toFixed(4)}, {formData.coordinates.lon.toFixed(4)}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="route">Assign to Route</Label>
                <Select onValueChange={(value) => setFormData(prev => ({ ...prev, routeId: value }))} value={formData.routeId || ""} disabled={loading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a route" />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="" disabled>Loading routes...</SelectItem>
                    ) : routes.length === 0 ? (
                      <SelectItem value="" disabled>No routes available</SelectItem>
                    ) : (
                      routes.map(route => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          {route.name} ({route.status}) {route.driverName && `- ${route.driverName}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Adding Delivery..." : "Add Delivery"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Map Card */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Map</CardTitle>
            <p className="text-sm text-gray-600">
              Click on the search icon in the top-right corner to search for locations directly on the map
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <MapComponent
                deliveries={deliveries.map(delivery => ({
                  id: delivery.id,
                  customer_name: delivery.customerName,
                  location: delivery.location,
                  coordinates: delivery.coordinates,
                  item: delivery.item,
                  phone: delivery.phone,
                  drop_time: delivery.dropTime.replace(' AM', '').replace(' PM', ''),
                  status: delivery.status as 'pending' | 'in-progress' | 'completed' | 'failed'
                }))}
                selectedDelivery={selectedDelivery ? {
                  id: selectedDelivery.id,
                  customer_name: selectedDelivery.customerName,
                  location: selectedDelivery.location,
                  coordinates: selectedDelivery.coordinates,
                  item: selectedDelivery.item,
                  phone: selectedDelivery.phone,
                  drop_time: selectedDelivery.dropTime.replace(' AM', '').replace(' PM', ''),
                  status: selectedDelivery.status as 'pending' | 'in-progress' | 'completed' | 'failed'
                } : null}
                onDeliverySelect={(delivery) => {
                  const localDelivery = deliveries.find(d => d.id === delivery.id)
                  if (localDelivery) setSelectedDelivery(localDelivery)
                }}
                showGeocoder={true}
                onLocationSelect={handleMapLocationSelect}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedDelivery?.id === delivery.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDelivery(delivery)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{delivery.customerName}</h3>
                    <p className="text-sm text-gray-600">{delivery.location}</p>
                    <p className="text-sm text-gray-500">{delivery.item} • {delivery.dropTime}</p>
                    {delivery.routeName && (
                      <p className="text-sm text-gray-500">Route: {delivery.routeName}</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      delivery.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : delivery.status === "in-progress"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {delivery.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Place Autocomplete</CardTitle>
        </CardHeader>
        <CardContent className="prose max-w-none">
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">1. Form Integration</h4>
              <p className="text-gray-600">
                Use the <code>PlaceAutocomplete</code> component in forms to let users search and select addresses. 
                It provides both the formatted address and coordinates.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">2. Map Search</h4>
              <p className="text-gray-600">
                The map includes a built-in geocoder control (search icon in top-right). Users can search 
                directly on the map and place markers.
              </p>
            </div>

            <div>
              <h4 className="font-medium">3. Features</h4>
              <ul className="text-gray-600 list-disc list-inside space-y-1">
                <li>Debounced search (300ms delay) for better performance</li>
                <li>Uses OpenStreetMap's Nominatim service (no API key required)</li>
                <li>Returns both formatted address and precise coordinates</li>
                <li>Keyboard navigation support</li>
                <li>Click outside to close suggestions</li>
                <li>Clear button to reset selection</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium">4. Customization</h4>
              <p className="text-gray-600">
                You can customize the search area by modifying the <code>countrycodes</code> parameter 
                in the Nominatim API call (currently set to 'ke' for Kenya).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 