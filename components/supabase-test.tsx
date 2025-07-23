"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function SupabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing')
  const [error, setError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<any[]>([])

  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    try {
      setConnectionStatus('testing')
      setError(null)

      // Test basic connection
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, status')
        .limit(3)

      if (error) {
        throw error
      }

      setDrivers(data || [])
      setConnectionStatus('connected')
    } catch (err: any) {
      console.error('Supabase connection error:', err)
      setError(err.message || 'Unknown error')
      setConnectionStatus('error')
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

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'testing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'connected':
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
          Supabase Connection Test
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

        {connectionStatus === 'connected' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              Sample Drivers Found: {drivers.length}
            </p>
            {drivers.map((driver) => (
              <div key={driver.id} className="flex items-center justify-between text-sm">
                <span>{driver.name}</span>
                <Badge variant="outline" className="text-xs">
                  {driver.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Common issues:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Check .env.local file exists</li>
              <li>• Verify SUPABASE_URL and ANON_KEY</li>
              <li>• Run SQL migrations in Supabase</li>
              <li>• Check RLS policies</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 