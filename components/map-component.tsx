"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types only – no runtime import ────────────────────────────────────────────
import type * as Leaflet from "leaflet"; // purely for IntelliSense/TS safety

//--------------------------------------------------------------------
// Helper to lazily load Leaflet JS & CSS + Routing Machine + Geocoder from CDN
//--------------------------------------------------------------------
async function loadLeaflet(): Promise<typeof Leaflet> {
  // If we've already loaded it, return immediately.
  if (
    (window as any).L &&
    (window as any).L.Routing &&
    (window as any).L.Control.Geocoder
  )
    return (window as any).L as typeof Leaflet;

  // 1. Inject Leaflet CSS once
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  // 2. Inject Routing Machine CSS
  if (!document.getElementById("leaflet-routing-css")) {
    const routingLink = document.createElement("link");
    routingLink.id = "leaflet-routing-css";
    routingLink.rel = "stylesheet";
    routingLink.href =
      "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css";
    document.head.appendChild(routingLink);
  }

  // 3. Inject Geocoder CSS
  if (!document.getElementById("leaflet-geocoder-css")) {
    const geocoderLink = document.createElement("link");
    geocoderLink.id = "leaflet-geocoder-css";
    geocoderLink.rel = "stylesheet";
    geocoderLink.href =
      "https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.css";
    document.head.appendChild(geocoderLink);
  }

  // 4. Load the Leaflet UMD script
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  // 5. Load the Routing Machine script
  await new Promise((resolve, reject) => {
    const routingScript = document.createElement("script");
    routingScript.src =
      "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js";
    routingScript.async = true;
    routingScript.onload = resolve;
    routingScript.onerror = reject;
    document.body.appendChild(routingScript);
  });

  // 6. Load the Geocoder script
  await new Promise((resolve, reject) => {
    const geocoderScript = document.createElement("script");
    geocoderScript.src =
      "https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.js";
    geocoderScript.async = true;
    geocoderScript.onload = resolve;
    geocoderScript.onerror = reject;
    document.body.appendChild(geocoderScript);
  });

  return (window as any).L as typeof Leaflet;
}

type DeliveryData = {
  id: number;
  customer_name: string;
  location: string;
  coordinates: [number, number]; // [lat, lng]
  item: string;
  estimated_value?: string | null;
  weight?: string | null;
  phone: string;
  drop_time: string;
  status: "pending" | "in-progress" | "completed" | "failed";
};

interface MapComponentProps {
  deliveries: DeliveryData[];
  selectedDelivery: DeliveryData | null;
  onDeliverySelect: (delivery: DeliveryData) => void;
  showGeocoder?: boolean; // New prop to control geocoder visibility
  onLocationSelect?: (location: {
    lat: number;
    lng: number;
    address: string;
  }) => void; // Callback for location selection
}

// export default function MapComponent({
//   deliveries,
//   selectedDelivery,
//   onDeliverySelect,
//   showGeocoder = true,
//   onLocationSelect
// }: MapComponentProps) {
//   const mapDivRef = useRef<HTMLDivElement>(null)
//   const mapRef = useRef<Leaflet.Map | null>(null)
//   const markersRef = useRef<Leaflet.Marker[]>([])
//   const routeRef = useRef<any>(null)
//   const geocoderRef = useRef<any>(null)

//   const [leafletReady, setLeafletReady] = useState(false)

//   // Load Leaflet once on mount
//   useEffect(() => {
//     loadLeaflet()
//       .then(() => setLeafletReady(true))
//       .catch((err) => console.error("Failed to load Leaflet:", err))
//   }, [])

//   // Initialise map after Leaflet is ready
//   useEffect(() => {
//     if (!leafletReady || mapRef.current || !mapDivRef.current) return

//     const L = (window as any).L as typeof Leaflet
//     mapRef.current = L.map(mapDivRef.current).setView([-1.2921, 36.8219], 11)

//     L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//       attribution: "© OpenStreetMap contributors",
//     }).addTo(mapRef.current)

//     // Add geocoder control if enabled
//     if (showGeocoder && (window as any).L.Control.Geocoder) {
//       geocoderRef.current = (window as any).L.Control.geocoder({
//         defaultMarkGeocode: false,
//         placeholder: "Search for places...",
//         errorMessage: "Nothing found.",
//         iconLabel: "Search",
//         collapsed: false,
//         position: 'topright'
//       })
//       .on('markgeocode', function(e: any) {
//         const bbox = e.geocode.bbox
//         const poly = L.polygon([
//           bbox.getSouthEast(),
//           bbox.getNorthEast(),
//           bbox.getNorthWest(),
//           bbox.getSouthWest()
//         ])
//         mapRef.current?.fitBounds(poly.getBounds())

//         // Add marker for selected location
//         const marker = L.marker([e.geocode.center.lat, e.geocode.center.lng])
//           .addTo(mapRef.current!)
//           .bindPopup(e.geocode.name)
//           .openPopup()

//         // Call callback if provided
//         if (onLocationSelect) {
//           onLocationSelect({
//             lat: e.geocode.center.lat,
//             lng: e.geocode.center.lng,
//             address: e.geocode.name
//           })
//         }
//       })
//       .addTo(mapRef.current)
//     }
//   }, [leafletReady, showGeocoder, onLocationSelect])

//   // Render markers & route whenever deliveries change
//   useEffect(() => {
//     if (!leafletReady || !mapRef.current) return
//     const L = (window as any).L as typeof Leaflet

//     // Clear previous markers
//     markersRef.current.forEach((m) => mapRef.current?.removeLayer(m))
//     markersRef.current = []

//     // Clear previous route
//     if (routeRef.current) {
//       mapRef.current.removeLayer(routeRef.current)
//       routeRef.current = null
//     }

//     // Helper to style markers by status
//     const markerIcon = (status: string, isSelected = false) => {
//       const color = status === "completed" ? "#10b981" : status === "in-progress" ? "#f59e0b" : "#6b7280"
//       const size = isSelected ? 24 : 20
//       const border = isSelected ? "4px solid #3b82f6" : "3px solid white"

//       return L.divIcon({
//         html: `<div style="
//             background:${color};
//             width:${size}px;
//             height:${size}px;
//             border-radius:50%;
//             border:${border};
//             box-shadow:0 2px 8px rgba(0,0,0,0.3);
//             transition: all 0.2s ease;
//             "></div>`,
//         className: "custom-marker",
//         iconSize: [size, size],
//         iconAnchor: [size / 2, size / 2],
//       })
//     }

//     // Helper function for customer name display
//     const getCustomerDisplayName = (delivery: DeliveryData) => {
//       if (delivery.customer_name && delivery.customer_name.trim()) {
//         return delivery.customer_name.trim();
//       } else {
//         return 'N/A'
//       }

//     }

//     // Add markers
//     deliveries.forEach((d) => {
//       const isSelected = selectedDelivery?.id === d.id
//       const marker = L.marker(d.coordinates, {
//         icon: markerIcon(d.status, isSelected),
//       }).addTo(mapRef.current!)

//       const popupContent = `
//         <div style="
//           padding: 12px;
//           min-width: 240px;
//           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//           background: white;
//           border-radius: 8px;
//           box-shadow: 0 4px 12px rgba(0,0,0,0.15);
//         ">
//           <div style="
//             font-weight: 600;
//             font-size: 16px;
//             color: #111827;
//             margin-bottom: 8px;
//             line-height: 1.2;
//           ">
//             ${getCustomerDisplayName(d)}
//           </div>

//           <div style="
//             display: flex;
//             align-items: flex-start;
//             gap: 6px;
//             margin-bottom: 8px;
//             padding: 6px 0;
//             border-bottom: 1px solid #f3f4f6;
//           ">
//             <span style="color: #6b7280; font-size: 14px;">📍</span>
//             <div style="
//               font-size: 13px;
//               color: #4b5563;
//               line-height: 1.3;
//               flex: 1;
//             ">
//               ${d.location || 'Location not specified'}
//             </div>
//           </div>

//           <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
//             <div style="display: flex; align-items: center; gap: 6px;">
//               <span style="color: #6b7280; font-size: 14px;">📦</span>
//               <span style="font-size: 13px; color: #374151; flex: 1;">
//                 ${d.item || 'Item not specified'}
//               </span>
//             </div>

//             <div style="display: flex; align-items: center; gap: 6px;">
//               <span style="color: #6b7280; font-size: 14px;">⏰</span>
//               <span style="font-size: 13px; color: #374151; flex: 1;">
//                 ${d.drop_time || 'Time not scheduled'}
//               </span>
//             </div>

//             ${d.phone ? `
//               <div style="display: flex; align-items: center; gap: 6px;">
//                 <span style="color: #6b7280; font-size: 14px;">📞</span>
//                 <span style="font-size: 13px; color: #374151; flex: 1;">
//                   ${d.phone}
//                 </span>
//               </div>
//             ` : ''}
//           </div>

//           ${d.estimated_value ? `
//             <div style="
//               display: flex;
//               align-items: center;
//               gap: 6px;
//               padding: 6px 8px;
//               background: #f0fdf4;
//               border-radius: 6px;
//               border: 1px solid #dcfce7;
//               margin-bottom: 8px;
//             ">
//               <span style="color: #059669; font-size: 14px;">💰</span>
//               <span style="
//                 font-size: 13px;
//                 color: #059669;
//                 font-weight: 600;
//                 flex: 1;
//               ">
//                 ${d.estimated_value}
//               </span>
//             </div>
//           ` : ''}

//           <div style="
//             display: flex;
//             align-items: center;
//             justify-content: space-between;
//             padding-top: 8px;
//             border-top: 1px solid #f3f4f6;
//           ">
//             <div style="
//               display: inline-flex;
//               align-items: center;
//               padding: 3px 8px;
//               border-radius: 12px;
//               font-size: 11px;
//               font-weight: 500;
//               text-transform: capitalize;
//               ${d.status === 'completed' ?
//                 'background: #dcfce7; color: #166534;' :
//                 d.status === 'in-progress' ?
//                 'background: #fef3c7; color: #92400e;' :
//                 'background: #f1f5f9; color: #475569;'
//               }
//             ">
//               ${d.status.replace('-', ' ')}
//             </div>

//             <div style="
//               font-size: 11px;
//               color: #9ca3af;
//               font-weight: 500;
//             ">
//               ID: ${d.id}
//             </div>
//           </div>
//         </div>
//       `

//       marker.bindPopup(popupContent, {
//         className: "custom-popup",
//         closeButton: true,
//         maxWidth: 280,
//         minWidth: 240,
//         offset: [0, -10],
//         autoPan: true,
//         keepInView: true,
//       })

//       marker.on("click", () => onDeliverySelect(d))
//       markersRef.current.push(marker)
//     })

//     // Draw street routing between delivery points using OSRM
//     if (deliveries.length > 1) {
//       const LWithRouting = (window as any).L

//       // Create waypoints from delivery coordinates
//       const waypoints = deliveries.map(d => LWithRouting.latLng(d.coordinates[0], d.coordinates[1]))

//       routeRef.current = LWithRouting.Routing.control({
//         waypoints: waypoints,
//         routeWhileDragging: false,
//         addWaypoints: false,
//         createMarker: function() { return null; }, // Don't create default markers
//         lineOptions: {
//           styles: [{
//             color: "#3b82f6",
//             weight: 4,
//             opacity: 0.8
//           }]
//         },
//         router: LWithRouting.Routing.osrmv1({
//           serviceUrl: 'https://router.project-osrm.org/route/v1'
//         }),
//         formatter: new LWithRouting.Routing.Formatter({
//           language: 'en',
//           units: 'metric'
//         }),
//         show: false, // Hide the routing instructions panel
//         collapsible: true,
//         draggableWaypoints: false,
//         fitSelectedRoutes: false
//       }).addTo(mapRef.current!)
//     }

//     // Fit map bounds
//     if (markersRef.current.length) {
//       const group = L.featureGroup(markersRef.current)
//       mapRef.current.fitBounds(group.getBounds().pad(0.1))
//     }
//   }, [deliveries, leafletReady, onDeliverySelect, selectedDelivery])

//   // Focus on a selected delivery
//   useEffect(() => {
//     if (!leafletReady || !mapRef.current || !selectedDelivery) return

//     // Find and update the selected marker
//     const selectedIndex = deliveries.findIndex((d) => d.id === selectedDelivery.id)
//     if (selectedIndex !== -1 && markersRef.current[selectedIndex]) {
//       const marker = markersRef.current[selectedIndex]
//       marker.openPopup()
//       mapRef.current.setView(selectedDelivery.coordinates, 14, { animate: true })
//     }
//   }, [selectedDelivery, leafletReady, deliveries])

//   // Public method to programmatically search for a location
//   const searchLocation = (query: string) => {
//     if (geocoderRef.current && leafletReady) {
//       geocoderRef.current.options.geocoder.geocode(query, function(results: any[]) {
//         if (results.length > 0) {
//           const result = results[0]
//           mapRef.current?.setView([result.center.lat, result.center.lng], 14)

//           if (onLocationSelect) {
//             onLocationSelect({
//               lat: result.center.lat,
//               lng: result.center.lng,
//               address: result.name
//             })
//           }
//         }
//       })
//     }
//   }

//   return (
//     <div
//       ref={mapDivRef}
//       className="w-full h-full rounded-lg border border-gray-200"
//       style={{
//         minHeight: "400px",
//         background: "#f9fafb",
//       }}
//     />
//   )
// }

import {
  GoogleMap,
  InfoWindow,
  Marker,
  Polyline,
} from "@react-google-maps/api";
import type { DriverLocation } from "@/lib/services/driver-locations";

interface MapComponentExtraProps {
  driverLocations?: Map<number, DriverLocation>;
  showDrivers?: boolean;
  routeId?: number;
  candidateDeliveries?: Array<DeliveryData & { priority_score?: number }>;
}

export default function MapComponent({
  deliveries,
  selectedDelivery,
  onDeliverySelect,
  driverLocations,
  showDrivers = false,
  routeId,
  candidateDeliveries,
}: MapComponentProps & MapComponentExtraProps) {
  const [routePath, setRoutePath] = useState<{ lat: number; lng: number }[]>(
    []
  );
  const [showInfoWindow, setShowInfoWindow] = useState<number | null>(null);
  const [markers, setMarkers] = useState<Map<number, any>>(new Map());
  const [driverMarkers, setDriverMarkers] = useState<Map<number, any>>(new Map());
  const [candidateMarkers, setCandidateMarkers] = useState<Map<number, any>>(new Map());
  const [map, setMap] = useState<any>(null);
  const [response, setResponse] = useState(null);

  const fetchRoute = useCallback(async () => {
    if (deliveries.length < 2) return;

    const origin = {
      lat: deliveries[0].coordinates[0],
      lng: deliveries[0].coordinates[1],
    };
    const destinations = deliveries
      .slice(1)
      .map((d) => ({ lat: d.coordinates[0], lng: d.coordinates[1] }));

    const res = await fetch("/api/places/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destinations }),
    });

    const data = await res.json();

    if (data.routes?.length) {
      const path: { lat: number; lng: number }[] = [];
      let encodedPoly = "";

      data.routes[0].legs.forEach((leg: any) => {
        leg.steps.forEach((step: any) => {
          if (step.polyline?.points) {
            if (!encodedPoly) encodedPoly = step.polyline.points;
            path.push(...decodePolyline(step.polyline.points));
          }
        });
      });

      setRoutePath(path);

      // Save polyline for delivery prioritization if we have a routeId
      if (routeId && path.length > 0) {
        try {
          const { RouteService } = await import("@/lib/services/routes");
          // Sample waypoints (every 5th point to keep it manageable)
          const sampledWaypoints = path.filter((_, i) => i % 5 === 0 || i === path.length - 1);
          await RouteService.saveRoutePolyline(
            routeId,
            encodedPoly,
            sampledWaypoints
          );
        } catch (e) {
          console.error("Failed to save route polyline:", e);
        }
      }
    }
  }, [deliveries, routeId]);

  useEffect(() => {
    fetchRoute();
  }, [deliveries, fetchRoute]);

  const getCustomerDisplayName = (delivery: DeliveryData) => {
    if (delivery.customer_name && delivery.customer_name.trim()) {
      return delivery.customer_name.trim();
    } else {
      return "N/A";
    }
  };
  const getMarkerColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#10b981";
      case "in-progress":
        return "#f59e0b";
      case "failed":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const createAdvancedMarker = useCallback(
    (delivery: DeliveryData, map: any) => {
      if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
        console.warn(
          " AdvancedMarkerElement not available, falling back to regular marker"
        );
        return null;
      }

      const markerElement = document.createElement("div");
      markerElement.style.width =
        selectedDelivery?.id === delivery.id ? "24px" : "16px";
      markerElement.style.height =
        selectedDelivery?.id === delivery.id ? "24px" : "16px";
      markerElement.style.borderRadius = "50%";
      markerElement.style.backgroundColor = getMarkerColor(delivery.status);
      markerElement.style.border =
        selectedDelivery?.id === delivery.id
          ? "4px solid #3b82f6"
          : "2px solid #ffffff";
      markerElement.style.cursor = "pointer";
      markerElement.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

      const advancedMarker =
        new window.google.maps.marker.AdvancedMarkerElement({
          map,
          position: {
            lat: delivery.coordinates[0],
            lng: delivery.coordinates[1],
          },
          content: markerElement,
          title: delivery.customer_name || "Delivery",
        });

      advancedMarker.addListener("click", () => {
        onDeliverySelect(delivery);
        setShowInfoWindow(delivery.id);
      });

      return advancedMarker;
    },
    [selectedDelivery, onDeliverySelect]
  );

  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    markers.forEach((marker) => {
      if (marker.setMap) marker.setMap(null);
    });
    const newMarkers = new Map();

    deliveries.forEach((delivery) => {
      const marker = createAdvancedMarker(delivery, map);
      if (marker) {
        newMarkers.set(delivery.id, marker);
      }
    });

    setMarkers(newMarkers);

    return () => {
      newMarkers.forEach((marker) => {
        if (marker.setMap) marker.setMap(null);
      });
    };
  }, [map, deliveries, createAdvancedMarker]);

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={
        deliveries?.[0]?.coordinates
          ? {
              lat: deliveries[0].coordinates[0],
              lng: deliveries[0].coordinates[1],
            }
          : { lat: -1.2852, lng: 36.8122 }
      }
      zoom={15}
      onLoad={(mapInstance) => setMap(mapInstance)}
      options={{
        mapId: "delivery-map", // Required for AdvancedMarkerElement
      }}
    >
      {/* {deliveries.map((d) => (
          <Marker
            key={d.id}
            position={{ lat: d.coordinates[0], lng: d.coordinates[1] }}
            onClick={() => {
              onDeliverySelect(d);
              setShowInfoWindow(d.id);
            }}
          />
        ))} */}

      {showInfoWindow && (
        <InfoWindow
          position={{
            lat:
              deliveries.find((d) => d.id === showInfoWindow)?.coordinates[0] ||
              0,
            lng:
              deliveries.find((d) => d.id === showInfoWindow)?.coordinates[1] ||
              0,
          }}
          onCloseClick={() => setShowInfoWindow(null)}
        >
          <div
            style={{
              padding: "12px",
              minWidth: "240px",
              fontFamily: "system-ui",
            }}
          >
            {(() => {
              const delivery = deliveries.find((d) => d.id === showInfoWindow);
              if (!delivery) return null;

              return (
                <>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "16px",
                      marginBottom: "8px",
                    }}
                  >
                    {getCustomerDisplayName(delivery)}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#4b5563",
                      marginBottom: "6px",
                    }}
                  >
                    📍 {delivery.location || "Location not specified"}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#374151",
                      marginBottom: "6px",
                    }}
                  >
                    📦 {delivery.item || "Item not specified"}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#374151",
                      marginBottom: "6px",
                    }}
                  >
                    ⏰ {delivery.drop_time || "Time not scheduled"}
                  </div>
                  {delivery.phone && (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#374151",
                        marginBottom: "6px",
                      }}
                    >
                      📞 {delivery.phone}
                    </div>
                  )}
                  {delivery.estimated_value && (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#059669",
                        fontWeight: "600",
                        marginBottom: "6px",
                      }}
                    >
                      💰 {delivery.estimated_value}
                    </div>
                  )}
                  <div
                    style={{
                      display: "inline-flex",
                      padding: "3px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "500",
                      textTransform: "capitalize",
                      backgroundColor:
                        delivery.status === "completed"
                          ? "#dcfce7"
                          : delivery.status === "in-progress"
                          ? "#fef3c7"
                          : "#f1f5f9",
                      color:
                        delivery.status === "completed"
                          ? "#166534"
                          : delivery.status === "in-progress"
                          ? "#92400e"
                          : "#475569",
                    }}
                  >
                    {delivery.status.replace("-", " ")}
                  </div>
                </>
              );
            })()}
          </div>
        </InfoWindow>
      )}
      {routePath.length > 0 && (
        <Polyline
          path={routePath}
          options={{
            strokeColor: "#3b82f6",
            strokeWeight: 4,
            strokeOpacity: 0.8,
          }}
        />
      )}

      {/* Driver location markers */}
      {showDrivers &&
        driverLocations &&
        Array.from(driverLocations.values()).map((driver) => (
          <Marker
            key={`driver-${driver.driver_id}`}
            position={{ lat: driver.lat, lng: driver.lng }}
            icon={{
              path: window?.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW || 0,
              scale: 6,
              fillColor: driver.is_online ? "#10b981" : "#6b7280",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              rotation: driver.heading || 0,
            }}
            title={driver.name}
            zIndex={1000}
          />
        ))}

      {/* Candidate (unassigned) delivery markers */}
      {candidateDeliveries &&
        candidateDeliveries.map((d) => (
          <Marker
            key={`candidate-${d.id}`}
            position={{ lat: d.coordinates[0], lng: d.coordinates[1] }}
            icon={{
              path: window?.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 8,
              fillColor: "#f59e0b",
              fillOpacity: 0.6,
              strokeColor: "#f59e0b",
              strokeWeight: 2,
              strokeOpacity: 1,
            }}
            title={`${d.customer_name} (Recommended)`}
            onClick={() => onDeliverySelect(d)}
          />
        ))}
    </GoogleMap>
  );
}

function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  let points: { lat: number; lng: number }[] = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let b: number,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// Export the search function for external use
export { MapComponent };