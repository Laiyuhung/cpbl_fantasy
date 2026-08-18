-- Create league_final_standings table to store final rankings
CREATE TABLE IF NOT EXISTS league_final_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES league_settings(league_id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES managers(manager_id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, manager_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_final_standings_league_id ON league_final_standings(league_id);
CREATE INDEX IF NOT EXISTS idx_league_final_standings_manager_id ON league_final_standings(manager_id);
CREATE INDEX IF NOT EXISTS idx_league_final_standings_rank ON league_final_standings(league_id, rank);

-- Add RLS policies
ALTER TABLE league_final_standings ENABLE ROW LEVEL SECURITY;

-- Allow commissioners to read and write final standings
CREATE POLICY "Commissioners can read final standings"
  ON league_final_standings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_final_standings.league_id
      AND league_members.manager_id = auth.uid()
      AND league_members.role IN ('Commissioner', 'Co-Commissioner')
    )
  );

CREATE POLICY "Commissioners can insert final standings"
  ON league_final_standings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_final_standings.league_id
      AND league_members.manager_id = auth.uid()
      AND league_members.role IN ('Commissioner', 'Co-Commissioner')
    )
  );

CREATE POLICY "Commissioners can update final standings"
  ON league_final_standings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_final_standings.league_id
      AND league_members.manager_id = auth.uid()
      AND league_members.role IN ('Commissioner', 'Co-Commissioner')
    )
  );

CREATE POLICY "Commissioners can delete final standings"
  ON league_final_standings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_final_standings.league_id
      AND league_members.manager_id = auth.uid()
      AND league_members.role IN ('Commissioner', 'Co-Commissioner')
    )
  );

-- Allow league members to read final standings for their league
CREATE POLICY "League members can read final standings"
  ON league_final_standings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE league_members.league_id = league_final_standings.league_id
      AND league_members.manager_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_league_final_standings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_league_final_standings_updated_at_trigger ON league_final_standings;
CREATE TRIGGER update_league_final_standings_updated_at_trigger
  BEFORE UPDATE ON league_final_standings
  FOR EACH ROW
  EXECUTE FUNCTION update_league_final_standings_updated_at();