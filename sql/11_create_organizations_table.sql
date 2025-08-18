-- Create organizations table for organization onboarding
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  address TEXT,
  website VARCHAR(255),
  orders_per_day VARCHAR(20),
  team_size VARCHAR(20),
  drivers_count VARCHAR(20),
  years_in_business VARCHAR(20),
  industry VARCHAR(50),
  primary_delivery_area VARCHAR(50),
  delivery_challenge VARCHAR(100),
  desired_features TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add some indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(contact_email);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);