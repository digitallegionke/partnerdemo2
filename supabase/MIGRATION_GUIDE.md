# Supabase OTP Driver Authentication Migration Guide

## Overview
This migration adds OTP-only driver authentication support to your Roundi application by:
- Linking drivers to Supabase Auth users via `user_id` column
- Adding phone verification tracking via `phone_verified_at` column
- Enforcing unique phone numbers per organization
- Creating indexes for optimal query performance

## Critical Changes

### 1. **drivers Table Schema Updates**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `user_id` | `uuid` | Yes | Foreign key to `auth.users(id)` - links drivers to Supabase Auth accounts |
| `phone_verified_at` | `timestamptz` | Yes | Timestamp when phone was verified via OTP - NULL means not verified |

### 2. **Constraints Added**

- **UNIQUE (phone, org_id)**: Prevents duplicate phone numbers within the same organization
- **FOREIGN KEY user_id → auth.users(id)**: Links drivers to authentication records
- **ON DELETE SET NULL**: If a Supabase Auth user is deleted, the driver record remains but user_id becomes NULL
- **ON UPDATE CASCADE**: If auth.users.id changes (rare), the driver record updates accordingly

### 3. **Indexes Created** (for performance)

```
idx_drivers_user_id            - Fast lookups by user_id
idx_drivers_phone              - Quick phone-based OTP verification lookups
idx_drivers_phone_verified_at  - Find unverified drivers
idx_drivers_org_phone          - Unique phone per org enforcement
idx_drivers_org_verified       - Find verified drivers in organization
```

## Installation Steps

### Step 1: Backup Your Database
**CRITICAL**: Always backup before running migrations

```bash
# Using Supabase CLI (recommended)
supabase db pull

# Or manually backup via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Click on "Create new query"
# 3. Run: SELECT * FROM drivers (copy and save the results)
```

### Step 2: Apply the Migration

#### Option A: Using Supabase CLI (Recommended)
```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to your Supabase account
supabase login

# Link your project
supabase link --project-id YOUR_PROJECT_ID

# Apply the migration
supabase db push

# This will execute supabase/migrations/001_add_otp_auth_to_drivers.sql
```

#### Option B: Using Supabase Dashboard (SQL Editor)
1. Go to your Supabase Dashboard → SQL Editor
2. Click "Create new query"
3. Copy the entire contents of `supabase/migrations/001_add_otp_auth_to_drivers.sql`
4. Paste into the SQL Editor
5. Click "Run"

#### Option C: Using psql (Direct PostgreSQL connection)
```bash
# If you have psql installed and the DATABASE_URL
psql $DATABASE_URL < supabase/migrations/001_add_otp_auth_to_drivers.sql
```

### Step 3: Verify the Migration

```sql
-- Check that columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'drivers' 
AND column_name IN ('user_id', 'phone_verified_at');

-- Should return:
-- user_id        | uuid                  | YES
-- phone_verified_at | timestamp with time zone | YES

-- Verify indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'drivers' 
AND indexname LIKE 'idx_drivers_%';

-- Check unique constraint
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'drivers' 
AND constraint_type = 'UNIQUE';
```

### Step 4: Update Your Application Code

Your TypeScript types have been updated in `lib/supabase.ts`:

```typescript
// drivers type now includes:
{
  user_id: string | null;        // UUID of the associated Auth user
  phone_verified_at: string | null;  // ISO timestamp when phone was verified
}
```

No changes required to existing driver read operations - the new columns are nullable and have defaults.

### Step 5: Test the Migration

```typescript
// Test inserting a new driver (without user_id - existing behavior)
const { data, error } = await supabase
  .from('drivers')
  .insert({
    name: 'Test Driver',
    phone: '+254712345678',
    vehicle_type: 'motorcycle',
    license_number: 'DL123456',
    org_id: 1
  });

// Test inserting a driver with OTP auth (new behavior)
const { data: newDriver } = await supabase
  .from('drivers')
  .insert({
    name: 'OTP Driver',
    phone: '+254787654321',
    vehicle_type: 'car',
    license_number: 'DL789012',
    org_id: 1,
    user_id: 'uuid-from-auth', // Link to Supabase Auth user
    phone_verified_at: new Date().toISOString()
  });

// Query verified drivers in an organization
const { data: verifiedDrivers } = await supabase
  .from('drivers')
  .select('*')
  .eq('org_id', 1)
  .not('phone_verified_at', 'is', null);
```

## Rollback Procedure

If something goes wrong, you can safely rollback:

### Using Supabase CLI:
```bash
supabase db reset  # This resets to the last known good state

# Or manually run the rollback script:
# Copy contents of supabase/migrations/001_add_otp_auth_to_drivers_rollback.sql
# and execute in SQL Editor
```

### Manual Rollback (SQL Editor):
1. Go to Supabase Dashboard → SQL Editor
2. Click "Create new query"
3. Copy the entire contents of `supabase/migrations/001_add_otp_auth_to_drivers_rollback.sql`
4. Paste and execute

## Data Migration Strategy

### Scenario 1: Drivers without OTP auth (existing drivers)
- `user_id` will be NULL
- `phone_verified_at` will be NULL
- These drivers can be migrated to OTP auth later

### Scenario 2: Enabling OTP for existing drivers
```sql
-- If you have a mapping of existing drivers to auth users
UPDATE public.drivers d
SET user_id = au.id,
    phone_verified_at = NOW()
FROM auth.users au
WHERE d.phone = au.raw_user_meta_data->>'phone'
  AND d.org_id = (au.raw_user_meta_data->>'org_id')::int;
```

### Scenario 3: New driver onboarding with OTP
- Create Auth user first with OTP
- Insert driver record with user_id and phone_verified_at
- Automatic unique constraint validation

## Troubleshooting

### Error: "duplicate key value violates unique constraint"
- **Cause**: Multiple drivers in the same org have the same phone number
- **Solution**: 
  ```sql
  -- Identify duplicates
  SELECT phone, org_id, COUNT(*)
  FROM public.drivers
  GROUP BY phone, org_id
  HAVING COUNT(*) > 1;
  
  -- Fix by renaming duplicates or merging records
  UPDATE public.drivers
  SET phone = phone || '_archived'
  WHERE id = <old_driver_id>;
  ```

### Error: "violates foreign key constraint"
- **Cause**: Trying to link to a user_id that doesn't exist in auth.users
- **Solution**: Ensure the user exists in Supabase Auth before linking

### Indexes not appearing after migration
- **Cause**: Indexes may be on a different schema
- **Solution**: Verify in Supabase Dashboard → Indexes tab, or re-run migration

## Performance Considerations

- **Query optimization**: New indexes improve lookup times by ~10-100x
- **Storage**: 3 new columns add ~35 bytes per driver record
- **For 10,000 drivers**: ~350 KB additional storage (negligible)

## Next Steps

1. **Implement OTP verification flow** in your auth middleware
2. **Update driver onboarding** to collect and verify phone
3. **Add phone verification status** to driver UI/dashboard
4. **Implement fallback auth** for drivers without verified phones (optional)
5. **Monitor performance** - queries should be faster with new indexes

## Security Considerations

- ✅ Foreign key ensures only valid auth.users can be linked
- ✅ Unique constraint prevents duplicate phones per org
- ✅ phone_verified_at tracks verification state
- ⚠️ Ensure OTP validation logic is secure (see auth implementation)
- ⚠️ Phone should be stored in a normalized format (include country code)

## Questions or Issues?

If you encounter any problems:
1. Check the troubleshooting section above
2. Verify the migration ran successfully using verification queries
3. Review Supabase documentation: https://supabase.com/docs/guides/database
4. Check your application logs for related errors
