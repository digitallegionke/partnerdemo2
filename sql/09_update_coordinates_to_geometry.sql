-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Update coordinates column to use PostGIS geometry
ALTER TABLE deliveries 
DROP COLUMN IF EXISTS coordinates CASCADE;

ALTER TABLE deliveries 
ADD COLUMN coordinates GEOMETRY(POINT, 4326) NOT NULL DEFAULT ST_GeomFromText('POINT(36.8219 -1.2921)', 4326);

-- Update existing data (if any) to use proper geometry format
-- This is just a placeholder - actual data migration would depend on existing data format

-- Recreate the index for better query performance
CREATE INDEX idx_deliveries_coordinates ON deliveries USING GIST (coordinates);

-- Update sample data with proper PostGIS geometry
DELETE FROM deliveries; -- Clear existing data first

-- Insert sample deliveries for Nairobi Central Route (route_id = 1)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(1, 'John Kamau', 'CBD Market', ST_GeomFromText('POINT(36.8172 -1.2864)', 4326), 'Tomatoes', 'KSh 2,500', '5kg', '+254712345678', '09:00', 'completed', 1),
(1, 'Mary Wanjiku', 'City Hall', ST_GeomFromText('POINT(36.8219 -1.2921)', 4326), 'Carrots', 'KSh 1,800', '3kg', '+254723456789', '09:30', 'completed', 2),
(1, 'Peter Mutua', 'Railway Station', ST_GeomFromText('POINT(36.8321 -1.3067)', 4326), 'Potatoes', 'KSh 3,200', '8kg', '+254734567890', '10:00', 'in-progress', 3),
(1, 'Grace Akinyi', 'Central Park', ST_GeomFromText('POINT(36.8233 -1.2884)', 4326), 'Onions', 'KSh 2,100', '5kg', '+254745678901', '10:30', 'pending', 4);

-- Insert sample deliveries for Westlands Circuit (route_id = 2)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(2, 'Samuel Kiprotich', 'Westlands Mall', ST_GeomFromText('POINT(36.8099 -1.2676)', 4326), 'Spinach', 'KSh 1,500', '2kg', '+254756789012', '08:00', 'completed', 1),
(2, 'Ruth Njeri', 'Sarit Centre', ST_GeomFromText('POINT(36.8076 -1.2689)', 4326), 'Kales', 'KSh 1,200', '4kg', '+254767890123', '08:45', 'completed', 2),
(2, 'Joseph Mwangi', 'ABC Place', ST_GeomFromText('POINT(36.8123 -1.2643)', 4326), 'Cabbages', 'KSh 2,000', '6kg', '+254778901234', '09:30', 'completed', 3);

-- Insert sample deliveries for Eastlands Express (route_id = 3)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(3, 'Agnes Wambui', 'Eastleigh Market', ST_GeomFromText('POINT(36.8441 -1.2741)', 4326), 'Bananas', 'KSh 1,800', '10kg', '+254789012345', '07:30', 'pending', 1),
(3, 'David Omondi', 'Donholm Shopping', ST_GeomFromText('POINT(36.8876 -1.2945)', 4326), 'Maize', 'KSh 3,500', '15kg', '+254790123456', '08:15', 'pending', 2),
(3, 'Helen Chebet', 'Umoja Market', ST_GeomFromText('POINT(36.8765 -1.2834)', 4326), 'Beans', 'KSh 2,200', '8kg', '+254701234567', '09:00', 'pending', 3);

-- Insert sample deliveries for Karen-Langata Loop (route_id = 4)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(4, 'Michael Wekesa', 'Karen Shopping', ST_GeomFromText('POINT(36.7085 -1.3197)', 4326), 'Avocados', 'KSh 4,000', '12kg', '+254712345679', '10:00', 'in-progress', 1),
(4, 'Susan Moraa', 'Junction Mall', ST_GeomFromText('POINT(36.7324 -1.3037)', 4326), 'Mangoes', 'KSh 3,200', '8kg', '+254723456780', '10:45', 'completed', 2),
(4, 'Francis Kiplagat', 'Langata Link', ST_GeomFromText('POINT(36.7208 -1.3654)', 4326), 'Oranges', 'KSh 2,800', '10kg', '+254734567891', '11:30', 'pending', 3); 