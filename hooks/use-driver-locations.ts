'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DriverLocationService, type DriverLocation } from '@/lib/services/driver-locations'

interface UseDriverLocationsOptions {
  routeId?: number
  enabled?: boolean
}

export function useDriverLocations({ routeId, enabled = true }: UseDriverLocationsOptions = {}) {
  const [locations, setLocations] = useState<Map<number, DriverLocation>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<any>(null)

  const fetchInitialLocations = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    try {
      const driverLocations = await DriverLocationService.getLatestLocations()
      const map = new Map<number, DriverLocation>()
      for (const loc of driverLocations) {
        if (routeId && loc.route_id !== routeId) continue
        map.set(loc.driver_id, loc)
      }
      setLocations(map)
    } catch (error) {
      console.error('Error fetching initial driver locations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [routeId, enabled])

  useEffect(() => {
    if (!enabled) {
      setLocations(new Map())
      setIsConnected(false)
      return
    }

    // Fetch initial data
    setIsLoading(true)
    DriverLocationService.getLatestLocations()
      .then((driverLocations) => {
        const map = new Map<number, DriverLocation>()
        for (const loc of driverLocations) {
          if (routeId && loc.route_id !== routeId) continue
          map.set(loc.driver_id, loc)
        }
        setLocations(map)
      })
      .catch((error) => console.error('Error fetching initial driver locations:', error))
      .finally(() => setIsLoading(false))

    // Subscribe to realtime updates
    const channel = DriverLocationService.subscribeToLocations(
      (update) => {
        setLocations((prev) => {
          const next = new Map(prev)
          const existing = next.get(update.driver_id)
          next.set(update.driver_id, {
            driver_id: update.driver_id,
            name: existing?.name || `Driver ${update.driver_id}`,
            lat: update.lat,
            lng: update.lng,
            heading: update.heading,
            speed: update.speed,
            route_id: update.route_id,
            recorded_at: update.recorded_at,
            is_online: true,
          })
          return next
        })
      },
      routeId
    )

    // Track real connection state
    channel.subscribe((status: string) => {
      setIsConnected(status === 'SUBSCRIBED')
    })

    channelRef.current = channel

    // Mark drivers offline if recorded_at is stale (5 minutes)
    const staleCheck = setInterval(() => {
      setLocations((prev) => {
        const next = new Map(prev)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        for (const [id, loc] of next) {
          if (!loc.recorded_at) continue
          if (new Date(loc.recorded_at).getTime() < fiveMinutesAgo) {
            next.set(id, { ...loc, is_online: false })
          }
        }
        return next
      })
    }, 30_000)

    return () => {
      clearInterval(staleCheck)
      if (channelRef.current) {
        DriverLocationService.unsubscribe(channelRef.current)
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [routeId, enabled])

  return {
    locations,
    isConnected,
    isLoading,
    refetch: fetchInitialLocations,
  }
}