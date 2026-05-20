-- Add archived flag to demand table
ALTER TABLE demand ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE demand ADD COLUMN IF NOT EXISTS archivedAt TIMESTAMP NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_demand_archived ON demand(archived);
CREATE INDEX IF NOT EXISTS idx_demand_archived_at ON demand(archivedAt);
