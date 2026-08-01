-- Create league_playoff_eliminated table to manage playoff eliminated status
CREATE TABLE IF NOT EXISTS league_playoff_eliminated (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES league_settings(league_id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES managers(manager_id) ON DELETE CASCADE,
  eliminated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, manager_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_playoff_eliminated_league_id ON league_playoff_eliminated(league_id);
CREATE INDEX IF NOT EXISTS idx_league_playoff_eliminated_manager_id ON league_playoff_eliminated(manager_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_league_playoff_eliminated_updated_at ON league_playoff_eliminated;
CREATE TRIGGER update_league_playoff_eliminated_updated_at
  BEFORE UPDATE ON league_playoff_eliminated
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
