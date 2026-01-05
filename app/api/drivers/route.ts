import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'
import { getSupabaseServer } from '@/lib/supabase-server'

// E.164 format validation: +[country code][number]
function validatePhoneFormat(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phone)
}

// Check if phone already exists in auth.users or drivers table
async function checkPhoneUniqueness(
  adminClient: Awaited<ReturnType<typeof getSupabaseServer>>,
  phone: string,
  orgId: number
): Promise<{ isUnique: boolean; error?: string }> {
  // Check drivers table for this org
  const { data: existingDriver, error: driverError } = await adminClient
    .from('drivers')
    .select('id')
    .match({ phone, org_id: orgId })
    .maybeSingle()

  if (driverError) {
    console.error('Error checking driver phone uniqueness:', driverError)
    return { isUnique: false, error: 'Failed to validate phone uniqueness in drivers table' }
  }

  if (existingDriver) {
    return { isUnique: false, error: `Phone number ${phone} already exists for a driver in this organization` }
  }

  // Check auth.users table
  const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers()

  if (authError) {
    console.error('Error checking auth users:', authError)
    return { isUnique: false, error: 'Failed to validate phone uniqueness in authentication system' }
  }

  const phoneExists = authUsers?.users?.some((u) => u.phone === phone)
  if (phoneExists) {
    return { isUnique: false, error: `Phone number ${phone} is already registered in the authentication system` }
  }

  return { isUnique: true }
}

// Create auth user and driver record with proper transaction handling
async function createDriverWithAuth(
  adminClient: Awaited<ReturnType<typeof getSupabaseServer>>,
  driverData: {
    name: string
    phone: string
    email: string | null
    avatar_url: string | null
    status: 'active' | 'inactive' | 'on_break'
    vehicle_type: string
    license_number: string
    org_id: number
  }
): Promise<{ success: boolean; data?: any; error?: string; authUserId?: string }> {
  // Step 1: Create auth user
  let authUser: any = null
  try {
    const { data, error } = await adminClient.auth.admin.createUser({
      phone: driverData.phone,
      phone_confirm: false,
      user_metadata: {
        role: 'driver',
        full_name: driverData.name,
      },
    })

    if (error) {
      console.error('Error creating auth user:', error)
      const errorMessage =
        error.message.includes('already exists') || error.message.includes('in use')
          ? `Phone number ${driverData.phone} is already registered`
          : `Failed to create authentication user: ${error.message}`
      return { success: false, error: errorMessage }
    }

    if (!data?.user?.id) {
      return { success: false, error: 'Failed to create auth user - no user ID returned' }
    }

    authUser = data.user
  } catch (err: any) {
    console.error('Unexpected error creating auth user:', err)
    return { success: false, error: `Unexpected error during authentication user creation: ${err.message}` }
  }

  // Step 2: Create driver record with user_id
  try {
    const insertPayload: any = {
      name: driverData.name,
      phone: driverData.phone,
      email: driverData.email,
      avatar_url: driverData.avatar_url,
      status: driverData.status,
      vehicle_type: driverData.vehicle_type,
      license_number: driverData.license_number,
      org_id: driverData.org_id,
      user_id: authUser.id,
    }

    const { data: driver, error: driverError } = await adminClient
      .from('drivers')
      .insert([insertPayload] as any)
      .select()
      .maybeSingle()

    if (driverError) {
      console.error('Error creating driver record:', driverError)

      // Step 3: Rollback - delete auth user if driver creation fails
      try {
        await adminClient.auth.admin.deleteUser(authUser.id)
        console.log(`Rolled back auth user ${authUser.id} due to driver creation failure`)
      } catch (rollbackErr: any) {
        console.error(`Failed to rollback auth user ${authUser.id}:`, rollbackErr)
      }

      const errorMessage = driverError.message.includes('duplicate')
        ? `Phone number ${driverData.phone} or license number ${driverData.license_number} already exists`
        : `Failed to create driver record: ${driverError.message}`

      return { success: false, error: errorMessage, authUserId: authUser.id }
    }

    if (!driver) {
      // Rollback auth user
      try {
        await adminClient.auth.admin.deleteUser(authUser.id)
        console.log(`Rolled back auth user ${authUser.id} due to empty driver response`)
      } catch (rollbackErr: any) {
        console.error(`Failed to rollback auth user ${authUser.id}:`, rollbackErr)
      }

      return { success: false, error: 'Failed to create driver - no data returned', authUserId: authUser.id }
    }

    return { success: true, data: driver, authUserId: authUser.id }
  } catch (err: any) {
    console.error('Unexpected error creating driver record:', err)

    // Rollback auth user
    try {
      await adminClient.auth.admin.deleteUser(authUser.id)
      console.log(`Rolled back auth user ${authUser.id} due to unexpected error`)
    } catch (rollbackErr: any) {
      console.error(`Failed to rollback auth user ${authUser.id}:`, rollbackErr)
    }

    return { success: false, error: `Unexpected error during driver creation: ${err.message}`, authUserId: authUser.id }
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error fetching membership:', membershipError)
      return NextResponse.json({ error: 'Error fetching organization membership' }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({ error: 'No organization found for this user' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        deliveries:deliveries(count)
      `)
      .eq('org_id', membership.organization_id)
      .order('name')

    if (error) {
      console.error('Error fetching drivers:', error)
      return NextResponse.json({ error: 'Failed to fetch drivers', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Unexpected error in GET /api/drivers:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the admin making the request
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    // Get organization membership
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error fetching membership:', membershipError)
      return NextResponse.json({ error: 'Error fetching organization membership' }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json({ error: 'No organization found for this user' }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    const required = ['name', 'phone', 'vehicle_type', 'license_number']
    const missing = required.filter((f) => !body[f])
    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    // Validate phone format (E.164)
    if (!validatePhoneFormat(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone format. Use E.164 format: +[country code][number] (e.g., +254712345678)' },
        { status: 400 }
      )
    }

    // Get service role client for admin operations
    const adminClient = await getSupabaseServer()

    // Check phone uniqueness before creating auth user
    const uniquenessCheck = await checkPhoneUniqueness(adminClient, body.phone, membership.organization_id)
    if (!uniquenessCheck.isUnique) {
      return NextResponse.json({ error: uniquenessCheck.error }, { status: 409 })
    }

    // Prepare driver data
    const driverData = {
      name: body.name,
      phone: body.phone,
      email: body.email ?? null,
      avatar_url: body.avatar_url ?? null,
      status: body.status ?? 'active',
      vehicle_type: body.vehicle_type,
      license_number: body.license_number,
      org_id: membership.organization_id,
    }

    // Create auth user and driver record with transaction handling
    const result = await createDriverWithAuth(adminClient, driverData)

    if (!result.success) {
      const statusCode = result.error?.includes('already')
        ? 409
        : result.error?.includes('Invalid')
          ? 400
          : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json(result.data, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/drivers:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}


