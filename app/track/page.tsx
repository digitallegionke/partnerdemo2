"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Truck,
  Search,
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  AlertCircle,
  Loader2
} from "lucide-react"
import Link from "next/link"

interface TrackingData {
  trackingNumber: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  customerName: string
  location: string
  item: string
  scheduledTime: string
  deliveredAt?: string
  attemptCount?: number
  deliveryNotes?: string
  proofOfDelivery?: string
  driver?: {
    name: string
    phone: string
    vehicleType: string
  }
  route?: {
    name: string
    status: string
  }
  timeline: Array<{
    status: string
    timestamp: string
    description: string
  }>
}

export default function TrackPackagePage() {
  const searchParams = useSearchParams()
  const [trackingNumber, setTrackingNumber] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)

  // Function to fetch tracking data
  const fetchTrackingData = useCallback(async (trackingNum: string) => {
    if (!trackingNum.trim()) return

    setIsLoading(true)
    setError(null)
    setTrackingData(null)

    try {
      const response = await fetch(`/api/track?trackingNumber=${encodeURIComponent(trackingNum.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to track package')
        return
      }

      if (data.success && data.delivery) {
        setTrackingData(data.delivery)
      } else {
        setError(data.error || 'No tracking information found')
      }
    } catch (err) {
      console.error('Tracking error:', err)
      setError('Failed to connect to tracking service. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-fetch if tracking number is in URL
  useEffect(() => {
    const urlTrackingNumber = searchParams.get('trackingNumber')
    if (urlTrackingNumber) {
      setTrackingNumber(urlTrackingNumber)
      fetchTrackingData(urlTrackingNumber)
    }
  }, [searchParams, fetchTrackingData])

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    fetchTrackingData(trackingNumber)
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
          description: 'Your package is being prepared for delivery'
        }
      case 'in-progress':
        return {
          label: 'In Transit',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Truck,
          description: 'Your package is on its way'
        }
      case 'completed':
        return {
          label: 'Delivered',
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          description: 'Your package has been delivered'
        }
      case 'failed':
        return {
          label: 'Failed',
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: XCircle,
          description: 'Delivery attempt was unsuccessful'
        }
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Package,
          description: ''
        }
    }
  }

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatTime = (time: string) => {
    // Handle HH:MM format
    if (time && time.includes(':')) {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${hour12}:${minutes} ${ampm}`
    }
    return time
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#C8E298] rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Roundi</h1>
                <p className="text-sm text-gray-600">Package Tracking</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Search Section */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-[#C8E298]" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Track Your Package</h2>
            <p className="text-lg text-gray-600 mb-8">
              Enter your tracking number to get real-time updates on your delivery
            </p>

            <Card className="bg-white shadow-lg border-0">
              <CardContent className="pt-6">
                <form onSubmit={handleTrack} className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="Enter tracking number (e.g., RD000123)"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="text-lg py-6 text-center"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#C8E298] hover:bg-[#b5d085] text-[#162318] text-lg py-6"
                    disabled={isLoading || !trackingNumber.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Tracking...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Track Package
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Your tracking number was sent to your email or phone when your order was placed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Message */}
          {error && (
            <Card className="bg-red-50 border-red-200 mb-6">
              <CardContent className="py-6">
                <div className="flex items-center justify-center text-red-700">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tracking Results */}
          {trackingData && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              {/* Status Card */}
              <Card className="bg-white shadow-lg border-0 overflow-hidden">
                <div className={`h-2 ${getStatusConfig(trackingData.status).color.split(' ')[0]}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Tracking Number</p>
                      <CardTitle className="text-xl">{trackingData.trackingNumber}</CardTitle>
                    </div>
                    <Badge className={`${getStatusConfig(trackingData.status).color} text-sm px-3 py-1`}>
                      {getStatusConfig(trackingData.status).label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    {getStatusConfig(trackingData.status).description}
                  </p>

                  {/* Delivery Details */}
                  <div className="grid gap-4 mt-6">
                    <div className="flex items-start space-x-3">
                      <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Item</p>
                        <p className="font-medium">{trackingData.item}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Delivery Address</p>
                        <p className="font-medium">{trackingData.location}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Scheduled Time</p>
                        <p className="font-medium">{formatTime(trackingData.scheduledTime)}</p>
                      </div>
                    </div>

                    {trackingData.deliveredAt && (
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Delivered At</p>
                          <p className="font-medium text-green-700">{formatDateTime(trackingData.deliveredAt)}</p>
                        </div>
                      </div>
                    )}

                    {trackingData.attemptCount && trackingData.attemptCount > 1 && (
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Delivery Attempts</p>
                          <p className="font-medium text-orange-700">{trackingData.attemptCount} attempts</p>
                        </div>
                      </div>
                    )}

                    {trackingData.deliveryNotes && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500 mb-1">Delivery Notes</p>
                        <p className="text-sm">{trackingData.deliveryNotes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Driver Info */}
              {trackingData.driver && (
                <Card className="bg-white shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Truck className="w-5 h-5 mr-2 text-[#C8E298]" />
                      Your Driver
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-lg">{trackingData.driver.name}</p>
                        <p className="text-sm text-gray-500">{trackingData.driver.vehicleType}</p>
                      </div>
                      <a
                        href={`tel:${trackingData.driver.phone}`}
                        className="flex items-center justify-center w-10 h-10 bg-[#C8E298] rounded-full text-[#162318] hover:bg-[#b5d085] transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              {trackingData.timeline.length > 0 && (
                <Card className="bg-white shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-[#C8E298]" />
                      Delivery Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {trackingData.timeline.map((event, index) => {
                        const StatusIcon = getStatusConfig(event.status).icon
                        const isLast = index === trackingData.timeline.length - 1

                        return (
                          <div key={index} className="flex items-start">
                            <div className="flex flex-col items-center mr-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                isLast ? 'bg-[#C8E298] text-[#162318]' : 'bg-gray-100 text-gray-500'
                              }`}>
                                <StatusIcon className="w-4 h-4" />
                              </div>
                              {index < trackingData.timeline.length - 1 && (
                                <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <p className={`font-medium ${isLast ? 'text-gray-900' : 'text-gray-700'}`}>
                                {event.description}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatDateTime(event.timestamp)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Track Another Package */}
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTrackingNumber('')
                    setTrackingData(null)
                    setError(null)
                  }}
                >
                  Track Another Package
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
