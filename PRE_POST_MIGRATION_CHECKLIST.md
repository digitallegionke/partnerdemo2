# 📋 Pre-Migration & Post-Migration Checklists

## 🔴 PRE-MIGRATION CHECKLIST (Do This First!)

### Database Backup
- [ ] Login to Supabase Dashboard
- [ ] Go to Settings → Backups
- [ ] Create manual backup now
- [ ] Note backup timestamp: _____________
- [ ] Test backup can be restored (optional but recommended)
- [ ] Save backup location/ID: _____________

### Code Review
- [ ] Read `SETUP_OTP_AUTH.md` (quick reference)
- [ ] Skim `supabase/README.md` (understand changes)
- [ ] Verify current Git branch: `git status`
- [ ] Current branch: `email_phone_validation` ✓

### Environment Setup
- [ ] Verify Supabase CLI installed: `supabase --version`
- [ ] If not installed: `npm install -g supabase`
- [ ] Verify logged in: `supabase projects list`
- [ ] Project ID handy: _____________

### Current State Documentation
- [ ] Run current verification query:
  ```sql
  SELECT COUNT(*) as total_drivers FROM drivers;
  ```
  Result: _______ drivers
- [ ] Check if any drivers already have phone duplicates:
  ```sql
  SELECT phone, COUNT(*) FROM drivers GROUP BY phone HAVING COUNT(*) > 1;
  ```
  Result: _______ duplicates found (should be 0 ideally)
- [ ] Screenshot of current schema: 
  ```sql
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name = 'drivers' ORDER BY ordinal_position;
  ```

### Risk Assessment
- [ ] All existing tests passing: `npm run build` ✓
- [ ] No uncommitted changes: `git status`
- [ ] Team informed of maintenance window
- [ ] Rollback plan understood
- [ ] Have contact for help if needed

---

## 🟢 MIGRATION EXECUTION CHECKLIST

### Step 1: Apply Migration

#### Option A: Using Supabase CLI (Recommended)
- [ ] Open terminal in project root
- [ ] Run: `supabase link --project-id YOUR_PROJECT_ID`
- [ ] Run: `supabase db push`
- [ ] Watch for confirmation message
- [ ] Should see: "Migration completed successfully"

#### Option B: Using SQL Editor
- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Copy entire contents of `supabase/migrations/001_add_otp_auth_to_drivers.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Wait for completion
- [ ] No errors should appear

#### Option C: Using psql
- [ ] Have DATABASE_URL handy
- [ ] Run: `psql $DATABASE_URL < supabase/migrations/001_add_otp_auth_to_drivers.sql`
- [ ] Wait for completion
- [ ] Check for errors

### Step 2: Verify Migration Applied

Run these verification queries in SQL Editor:

```sql
-- 1. Check new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'drivers' 
AND column_name IN ('user_id', 'phone_verified_at')
ORDER BY column_name;
```
- [ ] Should return 2 rows
- [ ] user_id should be uuid type, nullable
- [ ] phone_verified_at should be timestamp type, nullable

```sql
-- 2. Check foreign key exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'drivers' AND constraint_type = 'FOREIGN KEY';
```
- [ ] Should see: fk_drivers_user_id

```sql
-- 3. Check unique constraint exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'drivers' AND constraint_type = 'UNIQUE'
AND constraint_name = 'unique_phone_per_org';
```
- [ ] Should see: unique_phone_per_org

```sql
-- 4. Check indexes created
SELECT indexname FROM pg_indexes 
WHERE tablename = 'drivers' 
AND indexname LIKE 'idx_drivers_%'
ORDER BY indexname;
```
- [ ] Should see 5 indexes:
  - [ ] idx_drivers_org_phone
  - [ ] idx_drivers_org_verified
  - [ ] idx_drivers_phone
  - [ ] idx_drivers_phone_verified_at
  - [ ] idx_drivers_user_id

```sql
-- 5. Verify data integrity (important!)
SELECT COUNT(*) as total_drivers FROM drivers;
```
- [ ] Count should match backup count from pre-migration
- [ ] Count: _____________

```sql
-- 6. Test that existing drivers can still be queried
SELECT id, phone, name, user_id, phone_verified_at 
FROM drivers LIMIT 5;
```
- [ ] Results should show (no errors)
- [ ] user_id should all be NULL
- [ ] phone_verified_at should all be NULL

### Step 3: Update Application

- [ ] Run TypeScript check: `npm run build`
- [ ] Should complete without errors
- [ ] All imports still work
- [ ] No type errors

### Step 4: Test Helper Functions

```typescript
// In a test file or Node REPL:
import { 
  isPhoneVerified, 
  getDriverByPhone,
  normalizePhoneNumber 
} from '@/lib/otp-driver-auth';

// Test normalization
const phone = normalizePhoneNumber('0712345678');
console.assert(phone === '+254712345678', 'Phone normalization failed');

// Test query (should return null for unverified driver)
const driver = await getDriverByPhone('+254712345678', 1);
console.log('Sample driver query result:', driver);

console.log('✓ All helper functions working');
```
- [ ] No errors
- [ ] Helper functions accessible
- [ ] Can import all utilities

---

## 🟢 POST-MIGRATION VALIDATION (After 24 Hours)

### Performance Monitoring
- [ ] Run slow query log check:
  ```sql
  SELECT * FROM pg_stat_statements 
  WHERE query LIKE '%drivers%' 
  ORDER BY total_time DESC LIMIT 10;
  ```
- [ ] Queries should be fast (< 10ms for small queries)
- [ ] No timeout errors in logs

### Data Integrity Checks
- [ ] Run full data validation:
  ```sql
  -- Check for orphaned records (shouldn't happen)
  SELECT COUNT(*) FROM drivers WHERE user_id IS NOT NULL;
  -- Should be 0 initially
  ```
- [ ] No integrity errors in app logs

### Feature Testing
- [ ] Can still create drivers: ✓
- [ ] Can still update drivers: ✓
- [ ] Can still query drivers by ID: ✓
- [ ] Can still query by org_id: ✓
- [ ] New helper functions work: ✓

### Constraint Testing
- [ ] Test unique constraint (try adding duplicate phone):
  ```sql
  -- Find a driver
  SELECT id, phone, org_id FROM drivers LIMIT 1;
  
  -- Try to insert duplicate phone in same org
  INSERT INTO drivers (name, phone, vehicle_type, license_number, org_id)
  VALUES ('Test', '+254712345678', 'car', 'LIC', 1);
  ```
- [ ] Should get error: "duplicate key violates unique constraint"
- [ ] This is correct behavior ✓

### User Impact Assessment
- [ ] No driver functionality broken
- [ ] No UI errors in app
- [ ] All existing features work
- [ ] App performance not degraded
- [ ] Team feedback positive

---

## 🔴 ROLLBACK CHECKLIST (If Needed)

### Decision to Rollback
- [ ] Critical issue identified
- [ ] Issue confirmed not user error
- [ ] Cannot be fixed by code changes
- [ ] Rollback decided by team lead

### Execute Rollback

#### Option A: Using CLI
- [ ] Run: `supabase db reset`
- [ ] Confirms database reset
- [ ] Wait for completion
- [ ] Should see: "Database reset complete"

#### Option B: Manual SQL Rollback
- [ ] Open SQL Editor in Supabase Dashboard
- [ ] Create new query
- [ ] Copy: `supabase/migrations/001_add_otp_auth_to_drivers_rollback.sql`
- [ ] Paste into editor
- [ ] Run query
- [ ] No errors should appear

### Verify Rollback

```sql
-- 1. Check columns removed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'drivers' AND column_name IN ('user_id', 'phone_verified_at');
-- Should return 0 rows (columns gone)

-- 2. Check foreign key removed
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'drivers' AND constraint_name = 'fk_drivers_user_id';
-- Should return 0 rows (constraint gone)

-- 3. Check unique constraint removed
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'drivers' AND constraint_name = 'unique_phone_per_org';
-- Should return 0 rows (constraint gone)

-- 4. Data still intact
SELECT COUNT(*) FROM drivers;
-- Should match pre-migration count
```
- [ ] Columns removed
- [ ] Constraints removed
- [ ] Data preserved
- [ ] Database reverted to pre-migration state

### Post-Rollback
- [ ] Application still works
- [ ] TypeScript still compiles
- [ ] Team notified
- [ ] Post-mortem scheduled
- [ ] Root cause documented

---

## 📊 Success Metrics

### After Migration (should all be true)
- [ ] ✅ New columns exist in drivers table
- [ ] ✅ All 5 indexes created
- [ ] ✅ Foreign key constraint in place
- [ ] ✅ Unique constraint enforced
- [ ] ✅ TypeScript compilation succeeds
- [ ] ✅ All existing driver queries work
- [ ] ✅ New helper functions available
- [ ] ✅ Zero data loss
- [ ] ✅ No breaking changes
- [ ] ✅ Query performance improved

### Performance Improvement
- [ ] Driver lookup by phone: **before**: ______ms → **after**: ______ms
- [ ] Driver lookup by user_id: **before**: ______ms → **after**: ______ms
- [ ] Query indexes used: ✓ (verify with EXPLAIN)

### Team Sign-Off
- [ ] Backend developer: ________________ Date: ______
- [ ] QA/Tester: ________________ Date: ______
- [ ] Tech Lead: ________________ Date: ______
- [ ] Product Manager: ________________ Date: ______

---

## 🆘 Troubleshooting Quick Links

| Issue | Solution Location |
|-------|------------------|
| "Column already exists" | Already applied? Check step 2 above |
| "Duplicate key violation" | Existing phone duplicates - see Migration Guide |
| "Foreign key violation" | User doesn't exist - rollback and retry |
| "Index not found" | Try recreating - see SQL files |
| "TypeScript errors" | Run `npm install` then `npm run build` |
| "Permission denied" | Check Supabase API key/token permissions |
| "Connection timeout" | Check DATABASE_URL and network |

**For detailed troubleshooting, see**: `supabase/MIGRATION_GUIDE.md`

---

## 📞 Escalation

**If stuck**:
1. Check this checklist first
2. Review `supabase/MIGRATION_GUIDE.md` troubleshooting section
3. Contact: _______________ (Team Lead)
4. Escalate to: _______________ (Tech Lead)
5. Last resort: Rollback and try again

---

**Migration Date**: _____________  
**Applied By**: _____________  
**Verified By**: _____________  
**Status**: 🔴 Pending → 🟡 In Progress → 🟢 Complete → 🔵 Monitored

Good luck! 🚀
