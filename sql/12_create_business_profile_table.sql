-- Create business_profile table for organization onboarding
CREATE TABLE IF NOT EXISTS business_profile (
  id SERIAL PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL UNIQUE,
  contact_phone VARCHAR(50) NOT NULL,
  business_address TEXT,
  website VARCHAR(255),
  orders_per_day VARCHAR(20),
  team_size VARCHAR(20),
  drivers_count VARCHAR(20),
  years_in_business VARCHAR(20),
  industry VARCHAR(50),
  primary_delivery_area VARCHAR(50),
  delivery_challenge VARCHAR(100),
  desired_features TEXT,
  business_status VARCHAR(20) DEFAULT 'pending',
  profile_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_profile_updated_at 
    BEFORE UPDATE ON business_profile 
    FOR EACH ROW 
    EXECUTE FUNCTION update_business_profile_updated_at();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_business_profile_email ON business_profile(contact_email);
CREATE INDEX IF NOT EXISTS idx_business_profile_status ON business_profile(business_status);
CREATE INDEX IF NOT EXISTS idx_business_profile_created_at ON business_profile(created_at);
CREATE INDEX IF NOT EXISTS idx_business_profile_business_name ON business_profile(business_name);

-- Add some sample business profile data
INSERT INTO business_profile (
  business_name, 
  contact_email, 
  contact_phone, 
  business_address,
  website,
  orders_per_day,
  team_size,
  drivers_count,
  years_in_business,
  industry,
  primary_delivery_area,
  delivery_challenge,
  desired_features,
  business_status,
  profile_completed
) VALUES 
(
  'Sample Delivery Co',
  'admin@sampledelivery.com',
  '+254 700 000 000',
  '123 Business Street, Nairobi',
  'https://sampledelivery.com',
  '21-40',
  '11-20',
  '6-10',
  '4-6',
  'courier-logistics',
  'within-city',
  'planning',
  'Real-time tracking and route optimization features',
  'active',
  true
) ON CONFLICT (contact_email) DO NOTHING;