/**
 * GET /api/track?trackingNumber=XXX
 *
 * Public API endpoint for tracking deliveries
 * No authentication required - customers can check their package status
 *
 * Returns delivery status, location, and driver info if assigned
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export interface TrackingResponse {
  success: boolean;
  delivery?: {
    trackingNumber: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    customerName: string;
    location: string;
    item: string;
    scheduledTime: string;
    deliveredAt?: string;
    attemptCount?: number;
    deliveryNotes?: string;
    proofOfDelivery?: string;
    driver?: {
      name: string;
      phone: string;
      vehicleType: string;
    };
    route?: {
      name: string;
      status: string;
    };
    timeline: Array<{
      status: string;
      timestamp: string;
      description: string;
    }>;
  };
  error?: string;
}

/**
 * Generate a friendly tracking number from delivery ID
 * Format: RD + padded ID (e.g., RD000123)
 */
function formatTrackingNumber(id: number): string {
  return `RD${id.toString().padStart(6, '0')}`;
}

/**
 * Parse tracking number to get delivery ID
 * Accepts: RD000123, rd000123, 000123, or just 123
 */
function parseTrackingNumber(trackingNumber: string): number | null {
  const cleaned = trackingNumber.trim().toUpperCase();

  // Remove RD prefix if present
  const numericPart = cleaned.replace(/^RD/, '');

  // Parse as integer
  const id = parseInt(numericPart, 10);

  return isNaN(id) ? null : id;
}

/**
 * Build timeline from delivery data
 */
function buildTimeline(delivery: any): Array<{ status: string; timestamp: string; description: string }> {
  const timeline: Array<{ status: string; timestamp: string; description: string }> = [];

  // Created
  if (delivery.created_at) {
    timeline.push({
      status: 'created',
      timestamp: delivery.created_at,
      description: 'Delivery order created',
    });
  }

  // Assigned to route
  if (delivery.route_id) {
    timeline.push({
      status: 'assigned',
      timestamp: delivery.updated_at || delivery.created_at,
      description: 'Assigned to delivery route',
    });
  }

  // In progress
  if (delivery.status === 'in-progress' || delivery.status === 'completed') {
    timeline.push({
      status: 'in-progress',
      timestamp: delivery.updated_at,
      description: 'Driver is on the way',
    });
  }

  // Completed
  if (delivery.status === 'completed' && delivery.delivered_at) {
    timeline.push({
      status: 'completed',
      timestamp: delivery.delivered_at,
      description: 'Package delivered successfully',
    });
  }

  // Failed
  if (delivery.status === 'failed') {
    timeline.push({
      status: 'failed',
      timestamp: delivery.updated_at,
      description: `Delivery attempt failed${delivery.attempt_count ? ` (Attempt ${delivery.attempt_count})` : ''}`,
    });
  }

  return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function GET(req: NextRequest): Promise<NextResponse<TrackingResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const trackingNumber = searchParams.get('trackingNumber');

    if (!trackingNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tracking number is required',
        },
        { status: 400 }
      );
    }

    // Parse tracking number to get delivery ID
    const deliveryId = parseTrackingNumber(trackingNumber);

    if (deliveryId === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid tracking number format. Please use format: RD123456',
        },
        { status: 400 }
      );
    }

    // Use server Supabase client
    const supabase = await getSupabaseServer();

    // Fetch delivery with route and driver info
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        *,
        route:routes (
          id,
          name,
          status,
          driver:drivers (
            id,
            name,
            phone,
            vehicle_type
          )
        )
      `)
      .eq('id', deliveryId)
      .maybeSingle();

    if (deliveryError) {
      console.error('[track] Database error:', deliveryError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch tracking information',
        },
        { status: 500 }
      );
    }

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          error: 'No delivery found with this tracking number',
        },
        { status: 404 }
      );
    }

    // Build response
    const deliveryAny = delivery as any;
    const route = deliveryAny.route as any;
    const driver = route?.driver as any;

    const response: TrackingResponse = {
      success: true,
      delivery: {
        trackingNumber: formatTrackingNumber(deliveryAny.id),
        status: deliveryAny.status,
        customerName: deliveryAny.customer_name,
        location: deliveryAny.location,
        item: deliveryAny.item,
        scheduledTime: deliveryAny.drop_time,
        deliveredAt: deliveryAny.delivered_at || undefined,
        attemptCount: deliveryAny.attempt_count || undefined,
        deliveryNotes: deliveryAny.delivery_notes || undefined,
        proofOfDelivery: deliveryAny.proof_of_delivery || undefined,
        driver: driver ? {
          name: driver.name,
          phone: driver.phone,
          vehicleType: driver.vehicle_type,
        } : undefined,
        route: route ? {
          name: route.name,
          status: route.status,
        } : undefined,
        timeline: buildTimeline(delivery),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[track] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
