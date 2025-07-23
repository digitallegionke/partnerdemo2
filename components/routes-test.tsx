"use client"

import { useEffect, useState } from 'react'
import { RouteService } from '@/lib/services/routes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function RoutesTest() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [routes, setRoutes] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    testRoutes()
  }, [])

  const testRoutes = async () => {
    try {
      setStatus('loading')
      setError(null)

      // Test simple routes query first
      const data = await RouteService.getAllRoutesSimple()
      
      setRoutes(data || [])
      setStatus('success')
    } catch (err: any) {
      console.error('Routes test error:', err)
      setError(err.message || 'Unknown error')
      setStatus('error')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'loading':
        return 'Loading routes...'
      case 'success':
        return 'Routes loaded successfully'
      case 'error':
        return 'Failed to load routes'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Routes Data Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge className={getStatusColor()}>
          {getStatusText()}
        </Badge>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">Error:</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              Routes Found: {routes.length}
            </p>
            {routes.slice(0, 3).map((route) => (
              <div key={route.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="font-medium">{route.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {route.status}
                  </Badge>
                  {route.total_distance && (
                    <span className="text-xs text-gray-500">
                      {route.total_distance}km
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={testRoutes}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            🔄 Test Again
          </button>
        </div>
      </CardContent>
    </Card>
  )
} 