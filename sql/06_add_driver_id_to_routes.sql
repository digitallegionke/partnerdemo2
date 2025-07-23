-- Add missing driver_id column to routes table
-- This fixes the "column driver_id does not exist" error

DO $$
BEGIN
    -- Check if the driver_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'driver_id'
    ) THEN
        -- Add the driver_id column
        ALTER TABLE routes 
        ADD COLUMN driver_id BIGINT;
        
        -- Add the foreign key constraint
        ALTER TABLE routes 
        ADD CONSTRAINT routes_driver_id_fkey 
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
        
        -- Update any routes that might have invalid driver references
        UPDATE routes 
        SET driver_id = NULL 
        WHERE driver_id IS NOT NULL 
        AND driver_id NOT IN (SELECT id FROM drivers);
        
        RAISE NOTICE 'Successfully added driver_id column to routes table';
    ELSE
        RAISE NOTICE 'driver_id column already exists in routes table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'routes' AND column_name = 'driver_id'; 