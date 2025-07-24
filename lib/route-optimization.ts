interface Delivery {
  id: number
  customer_name: string
  location: string
  coordinates: [number, number] // [lat, lng]
  item: string
  estimated_value?: string | null
  weight?: string | null
  phone: string
  drop_time: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
}

interface OptimizationResult {
  originalOrder: Delivery[]
  optimizedOrder: Delivery[]
  originalDistance: number
  optimizedDistance: number
  originalDuration: number
  optimizedDuration: number
  improvementPercent: number
  timeSaved: number
  distanceSaved: number
  costSavings: number
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate total distance for a route
function calculateRouteDistance(points: Delivery[]): number {
  if (points.length < 2) return 0
  
  let totalDistance = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [lat1, lon1] = points[i].coordinates
    const [lat2, lon2] = points[i + 1].coordinates
    totalDistance += calculateDistance(lat1, lon1, lat2, lon2)
  }
  return totalDistance
}

// Nearest Neighbor Algorithm
function nearestNeighborOptimization(points: Delivery[]): Delivery[] {
  if (points.length <= 2) return [...points]
  
  const optimized: Delivery[] = []
  const remaining = [...points]
  
  // Start with the first point
  let current = remaining.shift()!
  optimized.push(current)
  
  while (remaining.length > 0) {
    let nearestIndex = 0
    let shortestDistance = Infinity
    
    // Find the nearest unvisited point
    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        current.coordinates[0], 
        current.coordinates[1],
        remaining[i].coordinates[0], 
        remaining[i].coordinates[1]
      )
      
      if (distance < shortestDistance) {
        shortestDistance = distance
        nearestIndex = i
      }
    }
    
    current = remaining.splice(nearestIndex, 1)[0]
    optimized.push(current)
  }
  
  return optimized
}

// 2-opt improvement algorithm
function twoOptImprovement(points: Delivery[]): Delivery[] {
  if (points.length <= 3) return [...points]
  
  let route = [...points]
  let improved = true
  
  while (improved) {
    improved = false
    
    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length; j++) {
        if (j - i === 1) continue // Skip adjacent edges
        
        const currentDistance = 
          calculateDistance(
            route[i - 1].coordinates[0], route[i - 1].coordinates[1],
            route[i].coordinates[0], route[i].coordinates[1]
          ) +
          calculateDistance(
            route[j].coordinates[0], route[j].coordinates[1],
            route[(j + 1) % route.length].coordinates[0], route[(j + 1) % route.length].coordinates[1]
          )
        
        const newDistance = 
          calculateDistance(
            route[i - 1].coordinates[0], route[i - 1].coordinates[1],
            route[j].coordinates[0], route[j].coordinates[1]
          ) +
          calculateDistance(
            route[i].coordinates[0], route[i].coordinates[1],
            route[(j + 1) % route.length].coordinates[0], route[(j + 1) % route.length].coordinates[1]
          )
        
        if (newDistance < currentDistance) {
          // Reverse the segment between i and j
          const newRoute = [
            ...route.slice(0, i),
            ...route.slice(i, j + 1).reverse(),
            ...route.slice(j + 1)
          ]
          route = newRoute
          improved = true
        }
      }
    }
  }
  
  return route
}

// Main optimization function
export function optimizeRoute(
  deliveries: Delivery[], 
  algorithm: 'nearest-neighbor' | 'genetic' | '2-opt' | 'simulated-annealing' = 'nearest-neighbor'
): OptimizationResult {
  if (deliveries.length <= 1) {
    return {
      originalOrder: [...deliveries],
      optimizedOrder: [...deliveries],
      originalDistance: 0,
      optimizedDistance: 0,
      originalDuration: 0,
      optimizedDuration: 0,
      improvementPercent: 0,
      timeSaved: 0,
      distanceSaved: 0,
      costSavings: 0
    }
  }
  
  const originalOrder = [...deliveries]
  let optimizedOrder: Delivery[]
  
  switch (algorithm) {
    case 'nearest-neighbor':
      optimizedOrder = nearestNeighborOptimization(deliveries)
      break
    case '2-opt':
      optimizedOrder = twoOptImprovement(deliveries)
      break
    case 'genetic':
      // For now, use nearest neighbor + 2-opt as a hybrid approach
      optimizedOrder = twoOptImprovement(nearestNeighborOptimization(deliveries))
      break
    case 'simulated-annealing':
      // Use 2-opt as a simplified version
      optimizedOrder = twoOptImprovement(deliveries)
      break
    default:
      optimizedOrder = nearestNeighborOptimization(deliveries)
  }
  
  const originalDistance = calculateRouteDistance(originalOrder)
  const optimizedDistance = calculateRouteDistance(optimizedOrder)
  
  // Estimate duration (assuming average speed of 30 km/h in city traffic + 5 min per stop)
  const originalDuration = (originalDistance / 30) * 60 + (originalOrder.length * 5) // minutes
  const optimizedDuration = (optimizedDistance / 30) * 60 + (optimizedOrder.length * 5) // minutes
  
  const distanceSaved = originalDistance - optimizedDistance
  const timeSaved = originalDuration - optimizedDuration
  const improvementPercent = originalDistance > 0 ? (distanceSaved / originalDistance) * 100 : 0
  
  // Cost calculation (KSh 50 per km + KSh 100 per stop)
  const originalCost = originalDistance * 50 + originalOrder.length * 100
  const optimizedCost = optimizedDistance * 50 + optimizedOrder.length * 100
  const costSavings = originalCost - optimizedCost
  
  return {
    originalOrder,
    optimizedOrder,
    originalDistance,
    optimizedDistance,
    originalDuration,
    optimizedDuration,
    improvementPercent,
    timeSaved,
    distanceSaved,
    costSavings
  }
}

// Optimize multiple routes
export function optimizeMultipleRoutes(
  routes: Array<{route: any, deliveries: Delivery[]}>,
  algorithm: 'nearest-neighbor' | 'genetic' | '2-opt' | 'simulated-annealing' = 'nearest-neighbor'
): Array<OptimizationResult & {routeId: number}> {
  return routes.map(({route, deliveries}) => ({
    routeId: route.id,
    ...optimizeRoute(deliveries, algorithm)
  }))
}

// Format time for display
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

// Format distance for display
export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`
}

// Format cost for display
export function formatCost(amount: number): string {
  return `KSh ${Math.round(amount).toLocaleString()}`
} 