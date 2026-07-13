-- Create league_playoff_seeds table to manage playoff seed assignments
CREATE TABLE IF NOT EXISTS league_playoff_seeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES league_settings(league_id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES managers(manager_id) ON DELETE CASCADE,
  seed INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, manager_id),
  UNIQUE(league_id, seed)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_playoff_seeds_league_id ON league_playoff_seeds(league_id);
CREATE INDEX IF NOT EXISTS idx_league_playoff_seeds_manager_id ON league_playoff_seeds(manager_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_league_playoff_seeds_updated_at
  BEFORE UPDATE ON league_playoff_seeds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
