-- Fix foreign key relationships and verify data integrity

-- Check if foreign key constraint exists and is working properly
DO $$
BEGIN
    -- Update any routes that reference non-existent drivers
    UPDATE routes 
    SET driver_id = NULL 
    WHERE driver_id IS NOT NULL 
    AND driver_id NOT IN (SELECT id FROM drivers);
    
    -- Re-create foreign key constraint if needed (should already exist)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'routes_driver_id_fkey'
    ) THEN
        ALTER TABLE routes 
        ADD CONSTRAINT routes_driver_id_fkey 
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Verify and fix any data inconsistencies
UPDATE routes SET driver_id = 1 WHERE id = 1 AND driver_id IS NULL;
UPDATE routes SET driver_id = 2 WHERE id = 2 AND driver_id IS NULL;
UPDATE routes SET driver_id = NULL WHERE id = 3 AND driver_id IS NOT NULL;
UPDATE routes SET driver_id = 3 WHERE id = 4 AND driver_id IS NULL;

-- Test the relationship by running a simple join
SELECT 
    r.id,
    r.name as route_name,
    r.status,
    d.name as driver_name,
    d.vehicle_type
FROM routes r
LEFT JOIN drivers d ON r.driver_id = d.id
ORDER BY r.id;

-- Verify RLS policies are working
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('routes', 'drivers', 'deliveries'); 