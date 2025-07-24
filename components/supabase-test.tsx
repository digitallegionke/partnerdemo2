"use client"

import { useEffect, useState } from 'react'
import { supabase, coordinatesToPoint, parsePointCoordinates } from '@/lib/supabase'
import { DeliveryService } from '@/lib/services/deliveries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, TestTube } from 'lucide-react'

export default function SupabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing')
  const [error, setError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [coordTest, setCoordTest] = useState<{
    original: [number, number]
    postgis: string
    parsed: [number, number]
    success: boolean
  } | null>(null)

  useEffect(() => {
    testConnection()
    testCoordinates()
  }, [])

  const testConnection = async () => {
    try {
      setConnectionStatus('testing')
      setError(null)

      // Test basic connection
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('id, name, status')
        .limit(3)

      if (driversError) {
        throw driversError
      }

      // Test deliveries fetch
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .limit(3)

      if (deliveriesError) {
        throw deliveriesError
      }

      setDrivers(driversData || [])
      setDeliveries(deliveriesData || [])
      setConnectionStatus('connected')
    } catch (err: any) {
      console.error('Supabase connection error:', err)
      setError(err.message || 'Unknown error')
      setConnectionStatus('error')
    }
  }

  const testCoordinates = () => {
    try {
      const original: [number, number] = [-1.2921, 36.8219] // Nairobi coordinates [lat, lng]
      const postgis = coordinatesToPoint(original)
      const parsed = parsePointCoordinates(postgis)
      
      setCoordTest({
        original,
        postgis,
        parsed,
        success: original[0] === parsed[0] && original[1] === parsed[1]
      })
    } catch (err) {
      console.error('Coordinate test error:', err)
      setCoordTest({
        original: [-1.2921, 36.8219],
        postgis: 'ERROR',
        parsed: [0, 0],
        success: false
      })
    }
  }

  const testDeliveryCreation = async () => {
    try {
      const testDelivery = {
        customer_name: 'Test Customer',
        location: 'Test Location',
        coordinates: {
          type: 'Point',
          coordinates: [36.8219, -1.2921] // GeoJSON format: [longitude, latitude]
        },
        item: 'Test Item',
        estimated_value: 'KSh 1,000',
        weight: '2kg',
        phone: '+254700000000',
        drop_time: '10:00',
        status: 'pending'
      }

      console.log('Testing delivery creation with:', testDelivery)
      const result = await DeliveryService.createDelivery(testDelivery)
      console.log('Test delivery created successfully:', result)
      
      // Clean up - delete the test delivery
      await DeliveryService.deleteDelivery(result.id)
      console.log('Test delivery cleaned up')
      
      alert('✅ Delivery creation test passed!')
    } catch (err: any) {
      console.error('Delivery creation test failed:', err)
      alert(`❌ Delivery creation test failed: ${err.message}`)
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing':
        return <AlertCircle className="h-5 w-5 text-yellow-500 animate-pulse" />
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'testing':
        return 'Testing connection...'
      case 'connected':
        return 'Connected successfully'
      case 'error':
        return 'Connection failed'
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Supabase Connection Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}>
                {getStatusText()}
              </Badge>
            </div>
            
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                <strong>Error:</strong> {error}
                {error.includes('anon_key') && (
                  <div className="mt-2">
                    <strong>Fix:</strong> Add your Supabase anonymous key to .env.local
                  </div>
                )}
              </div>
            )}

            {connectionStatus === 'connected' && (
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Sample Drivers ({drivers.length})</h4>
                  <div className="text-xs text-gray-600">
                    {drivers.map(driver => driver.name).join(', ')}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Sample Deliveries ({deliveries.length})</h4>
                  <div className="text-xs text-gray-600">
                    {deliveries.map(delivery => delivery.customer_name).join(', ')}
                  </div>
                </div>

                <Button 
                  onClick={testDeliveryCreation}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <TestTube className="h-4 w-4" />
                  Test Delivery Creation
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {coordTest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {coordTest.success ? 
                <CheckCircle className="h-5 w-5 text-green-500" /> : 
                <XCircle className="h-5 w-5 text-red-500" />
              }
              Coordinate Conversion Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Original [lat, lng]:</strong> [{coordTest.original[0]}, {coordTest.original[1]}]</div>
              <div><strong>PostGIS format:</strong> {coordTest.postgis}</div>
              <div><strong>Parsed back:</strong> [{coordTest.parsed[0]}, {coordTest.parsed[1]}]</div>
              <Badge variant={coordTest.success ? 'default' : 'destructive'}>
                {coordTest.success ? 'Conversion OK' : 'Conversion Failed'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 