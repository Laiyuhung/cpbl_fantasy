-- Create league_final_standings table to store final rankings
CREATE TABLE IF NOT EXISTS league_final_standings (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL,
  manager_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT league_final_standings_pkey PRIMARY KEY (id),
  CONSTRAINT league_final_standings_league_id_manager_id_key UNIQUE (league_id, manager_id),
  CONSTRAINT league_final_standings_league_id_fkey FOREIGN KEY (league_id) REFERENCES league_settings (league_id) ON DELETE CASCADE,
  CONSTRAINT league_final_standings_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers (manager_id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_league_final_standings_league_id ON league_final_standings USING btree (league_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_league_final_standings_manager_id ON league_final_standings USING btree (manager_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_league_final_standings_rank ON league_final_standings USING btree (league_id, rank) TABLESPACE pg_default;

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

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_league_final_standings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_league_final_standings_updated_at_trigger ON league_final_standings;
CREATE TRIGGER update_league_final_standings_updated_at_trigger
  BEFORE UPDATE ON league_final_standings
  FOR EACH ROW
  EXECUTE FUNCTION update_league_final_standings_updated_at();