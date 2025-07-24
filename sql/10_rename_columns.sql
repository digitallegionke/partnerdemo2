-- Rename columns in deliveries table (preserves existing data)
ALTER TABLE deliveries 
RENAME COLUMN farmer_name TO customer_name;

ALTER TABLE deliveries 
RENAME COLUMN produce TO item; 