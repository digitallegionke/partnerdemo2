-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  route_id BIGINT REFERENCES routes(id) ON DELETE CASCADE,
  driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create trigger for schedules table
CREATE TRIGGER update_schedules_updated_at 
  BEFORE UPDATE ON schedules
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample schedules
INSERT INTO schedules (title, route_id, driver_id, scheduled_date, start_time, end_time, status, priority, notes) VALUES
('Morning Deliveries - Route A', 1, 1, '2024-01-15', '08:00', '12:00', 'completed', 'high', 'Priority route for city center'),
('Westlands Circuit', 2, 2, '2024-01-15', '09:00', '13:00', 'completed', 'medium', 'Regular westlands delivery run'),
('Afternoon Deliveries - Route B', 4, 3, '2024-01-15', '14:00', '18:00', 'scheduled', 'low', 'Afternoon suburban route'),
('Express Deliveries', 1, 1, '2024-01-16', '10:00', '14:00', 'scheduled', 'high', 'Express delivery service'),
('Eastlands Express', 3, NULL, '2024-01-16', '08:00', '12:00', 'scheduled', 'medium', 'Unassigned route - needs driver'),
('Karen-Langata Loop', 4, 3, '2024-01-17', '09:00', '15:00', 'scheduled', 'medium', 'Weekend delivery schedule');

-- Create indexes for better query performance
CREATE INDEX idx_schedules_scheduled_date ON schedules(scheduled_date);
CREATE INDEX idx_schedules_driver_id ON schedules(driver_id);
CREATE INDEX idx_schedules_route_id ON schedules(route_id);
CREATE INDEX idx_schedules_status ON schedules(status);

-- Enable RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Create policy for schedules
CREATE POLICY "Allow all operations on schedules" ON schedules
FOR ALL USING (true) WITH CHECK (true); 