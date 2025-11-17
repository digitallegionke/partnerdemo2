import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from '@/lib/supabase'

// Type for update data
interface UpdateData {
  lastUpdated: string;
  updated_by: string;
  name?: string;
  address?: string;
  coordinates?: string;
  locationName?: string | null;
  type?: "warehouse" | "depot" | "pickup_point" | "hub";
  capacity?: number;
  openingHours?: string;
  closingHours?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  description?: string;
  status?: "active" | "inactive" | "maintenance";
}

// Validation schema for updates
const updateCollectionPointSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .optional(),
  address: z
    .string()
    .min(1, "Address is required")
    .max(200, "Address too long")
    .optional(),
  coordinates: z.array(z.number()).length(2, 'Coordinates must be [lat, lng]').optional(),
  locationName: z.string().max(200, 'Location name too long').optional().or(z.literal('')).nullable(),
  type: z.enum(["warehouse", "depot", "pickup_point", "hub"]).optional(), 
  capacity: z
    .number()
    .min(1, "Capacity must be at least 1")
    .max(10000, "Capacity too large")
    .optional(),
  openingHours: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, "Invalid time format")
    .optional(),
  closingHours: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, "Invalid time format")
    .optional(),
  contactPerson: z
    .string()
    .min(1, "Contact person is required")
    .max(100, "Name too long")
    .optional(),
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(20, "Phone too long")
    .optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "inactive", "maintenance"]).optional(),
});

// GET /api/collection-points/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const resolvedParams = await params

    const { data, error } = await supabase
      .from("collection_points")
      .select("*")
      .eq("id", resolvedParams.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection point not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("GET /api/collection-points/[id] error:", error)
    
    if (error instanceof Error && error.message === 'Authorization header required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch collection point" },
      { status: 500 }
    )
  }
}

// PATCH /api/collection-points/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const resolvedParams = await params

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Invalid or expired token')

    // Get profile.id (used for updated_by)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile query error:', profileError)
      throw new Error('Profile not found')
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = updateCollectionPointSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.issues },
        { status: 400 }
      )
    }

    // Prepare update data with only changed fields
    const updateData: Partial<UpdateData> = {
      lastUpdated: new Date().toISOString(),
      updated_by: profile.id,
    };

    // Handle each field from validation data
    Object.keys(validation.data).forEach(key => {
      if (key === 'coordinates') {
        // Convert coordinates array to PostgreSQL POINT format
        if (validation.data.coordinates) {
          const [lat, lng] = validation.data.coordinates;
          updateData.coordinates = `(${lng},${lat})`; // PostgreSQL POINT format: (longitude,latitude)
        }
      } else {
        // Copy other fields directly
        (updateData as Record<string, unknown>)[key] = (validation.data as Record<string, unknown>)[key];
      }
    });

    const { data, error } = await supabase
      .from("collection_points")
      .update(updateData)
      .eq("id", resolvedParams.id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection point not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("PATCH /api/collection-points/[id] error:", error)
    
    if (error instanceof Error) {
      if (error.message === 'Authorization header required') {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'Invalid or expired token') {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'Profile not found') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update collection point" },
      { status: 500 }
    )
  }
}

// DELETE /api/collection-points/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))
    const resolvedParams = await params

    const { error } = await supabase
      .from("collection_points")
      .delete()
      .eq("id", resolvedParams.id)

    if (error) throw error

    return NextResponse.json({ message: "Collection point deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/collection-points/[id] error:", error)
    
    if (error instanceof Error && error.message === 'Authorization header required') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete collection point" },
      { status: 500 }
    )
  }
}
