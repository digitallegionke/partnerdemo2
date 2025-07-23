"use client"

import { useEffect, useRef, useState } from "react"

// ─── Types only – no runtime import ────────────────────────────────────────────
import type * as Leaflet from "leaflet" // purely for IntelliSense/TS safety

//--------------------------------------------------------------------
// Helper to lazily load Leaflet JS & CSS + Routing Machine from CDN
//--------------------------------------------------------------------
async function loadLeaflet(): Promise<typeof Leaflet> {
  // If we've already loaded it, return immediately.
  if ((window as any).L && (window as any).L.Routing) return (window as any).L as typeof Leaflet

  // 1. Inject Leaflet CSS once
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link")
    link.id = "leaflet-css"
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)
  }

  // 2. Inject Routing Machine CSS
  if (!document.getElementById("leaflet-routing-css")) {
    const routingLink = document.createElement("link")
    routingLink.id = "leaflet-routing-css"
    routingLink.rel = "stylesheet"
    routingLink.href = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css"
    document.head.appendChild(routingLink)
  }

  // 3. Load the Leaflet UMD script
  await new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })

  // 4. Load the Routing Machine script
  await new Promise((resolve, reject) => {
    const routingScript = document.createElement("script")
    routingScript.src = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"
    routingScript.async = true
    routingScript.onload = resolve
    routingScript.onerror = reject
    document.body.appendChild(routingScript)
  })

  return (window as any).L as typeof Leaflet
}

//--------------------------------------------------------------------
// Component
//--------------------------------------------------------------------
interface Delivery {
  id: number
  farmerName: string
  location: string
  coordinates: [number, number]
  produce: string
  dropTime: string
  status: string
  phone: string
  estimatedValue?: string
  weight?: string
}

interface MapComponentProps {
  deliveries: Delivery[]
  selectedDelivery: Delivery | null
  onDeliverySelect: (delivery: Delivery) => void
}

export default function MapComponent({ deliveries, selectedDelivery, onDeliverySelect }: MapComponentProps) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const markersRef = useRef<Leaflet.Marker[]>([])
  const routeRef = useRef<any>(null)

  const [leafletReady, setLeafletReady] = useState(false)

  // Load Leaflet once on mount
  useEffect(() => {
    loadLeaflet()
      .then(() => setLeafletReady(true))
      .catch((err) => console.error("Failed to load Leaflet:", err))
  }, [])

  // Initialise map after Leaflet is ready
  useEffect(() => {
    if (!leafletReady || mapRef.current || !mapDivRef.current) return

    const L = (window as any).L as typeof Leaflet
    mapRef.current = L.map(mapDivRef.current).setView([-1.2921, 36.8219], 11)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapRef.current)
  }, [leafletReady])

  // Render markers & route whenever deliveries change
  useEffect(() => {
    if (!leafletReady || !mapRef.current) return
    const L = (window as any).L as typeof Leaflet

    // Clear previous markers
    markersRef.current.forEach((m) => mapRef.current?.removeLayer(m))
    markersRef.current = []

    // Clear previous route
    if (routeRef.current) {
      mapRef.current.removeLayer(routeRef.current)
      routeRef.current = null
    }

    // Helper to style markers by status
    const markerIcon = (status: string, isSelected = false) => {
      const color = status === "completed" ? "#10b981" : status === "in-progress" ? "#f59e0b" : "#6b7280"
      const size = isSelected ? 24 : 20
      const border = isSelected ? "4px solid #3b82f6" : "3px solid white"

      return L.divIcon({
        html: `<div style="
            background:${color};
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            border:${border};
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.2s ease;
            "></div>`,
        className: "custom-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
    }

    // Add markers
    deliveries.forEach((d) => {
      const isSelected = selectedDelivery?.id === d.id
      const marker = L.marker(d.coordinates, {
        icon: markerIcon(d.status, isSelected),
      }).addTo(mapRef.current!)

      const popupContent = `
        <div style="padding: 8px; min-width: 200px; font-family: system-ui;">
          <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 4px;">
            ${d.farmerName}
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
            📍 ${d.location}
          </div>
          <div style="font-size: 12px; color: #374151; margin-bottom: 4px;">
            📦 ${d.produce}
          </div>
          <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">
            ⏰ ${d.dropTime}
          </div>
          ${
            d.estimatedValue
              ? `
            <div style="font-size: 12px; color: #059669; font-weight: 500;">
              💰 ${d.estimatedValue}
            </div>
          `
              : ""
          }
        </div>
      `

      marker.bindPopup(popupContent, {
        className: "custom-popup",
        closeButton: true,
        maxWidth: 250,
      })

      marker.on("click", () => onDeliverySelect(d))
      markersRef.current.push(marker)
    })

    // Draw street routing between delivery points using OSRM
    if (deliveries.length > 1) {
      const LWithRouting = (window as any).L
      
      // Create waypoints from delivery coordinates
      const waypoints = deliveries.map(d => LWithRouting.latLng(d.coordinates[0], d.coordinates[1]))
      
      routeRef.current = LWithRouting.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: function() { return null; }, // Don't create default markers
        lineOptions: {
          styles: [{
            color: "#3b82f6",
            weight: 4,
            opacity: 0.8
          }]
        },
        router: LWithRouting.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        formatter: new LWithRouting.Routing.Formatter({
          language: 'en',
          units: 'metric'
        }),
        show: false, // Hide the routing instructions panel
        collapsible: true,
        draggableWaypoints: false,
        fitSelectedRoutes: false
      }).addTo(mapRef.current!)
    }

    // Fit map bounds
    if (markersRef.current.length) {
      const group = L.featureGroup(markersRef.current)
      mapRef.current.fitBounds(group.getBounds().pad(0.1))
    }
  }, [deliveries, leafletReady, onDeliverySelect, selectedDelivery])

  // Focus on a selected delivery
  useEffect(() => {
    if (!leafletReady || !mapRef.current || !selectedDelivery) return

    // Find and update the selected marker
    const selectedIndex = deliveries.findIndex((d) => d.id === selectedDelivery.id)
    if (selectedIndex !== -1 && markersRef.current[selectedIndex]) {
      const marker = markersRef.current[selectedIndex]
      marker.openPopup()
      mapRef.current.setView(selectedDelivery.coordinates, 14, { animate: true })
    }
  }, [selectedDelivery, leafletReady, deliveries])

  return (
    <div
      ref={mapDivRef}
      className="w-full h-full rounded-lg border border-gray-200"
      style={{
        minHeight: "400px",
        background: "#f9fafb",
      }}
    />
  )
}
