import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * POST /api/deliveries/assign-to-route
 *
 * Assigns one or more deliveries to a route.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { delivery_ids, route_id } = body

    if (!Array.isArray(delivery_ids) || delivery_ids.length === 0 || !route_id) {
      return NextResponse.json(
        { error: 'delivery_ids (array) and route_id are required' },
        { status: 400 }
      )
    }

    // Verify route exists
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id')
      .eq('id', route_id)
      .maybeSingle()

    if (routeError || !route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    // Get current max order_index for this route
    const { data: existingDeliveries } = await supabase
      .from('deliveries')
      .select('order_index')
      .eq('route_id', route_id)
      .order('order_index', { ascending: false })
      .limit(1)

    let nextIndex = (existingDeliveries?.[0]?.order_index ?? -1) + 1

    // Update each delivery to assign it to the route
    const results = []
    for (const deliveryId of delivery_ids) {
      const { data, error } = await supabase
        .from('deliveries')
        .update({
          route_id,
          order_index: nextIndex++,
        })
        .eq('id', deliveryId)
        .is('route_id', null) // Only assign if currently unassigned
        .select()
        .maybeSingle()

      if (error) {
        console.error(`Error assigning delivery ${deliveryId}:`, error)
      } else if (data) {
        results.push(data)
      }
    }

    return NextResponse.json({
      assigned: results.length,
      total_requested: delivery_ids.length,
      deliveries: results,
    })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/deliveries/assign-to-route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
