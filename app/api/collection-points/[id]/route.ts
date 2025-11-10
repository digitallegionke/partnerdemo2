import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from '@/lib/supabase'

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
});

// GET /api/collection-points/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data, error } = await supabase
      .from("collection_points")
      .select("*")
      .eq("id", params.id)
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
    const updateData: any = {
      ...validation.data,
      lastUpdated: new Date().toISOString(),
      updated_by: profile.id,
    }

    const { data, error } = await supabase
      .from("collection_points")
      .update(updateData)
      .eq("id", params.id)
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

    const { error } = await supabase
      .from("collection_points")
      .delete()
      .eq("id", params.id)

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
