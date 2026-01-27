-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_draft_roster_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create draft_roster_assignments table (if not exists)
CREATE TABLE IF NOT EXISTS public.draft_roster_assignments (
    assignment_id UUID NOT NULL DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    manager_id UUID NOT NULL,
    player_id UUID NOT NULL,
    roster_slot CHARACTER VARYING(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    CONSTRAINT draft_roster_assignments_pkey PRIMARY KEY (assignment_id),
    CONSTRAINT unique_player_per_manager UNIQUE (league_id, manager_id, player_id),
    CONSTRAINT unique_slot_per_manager UNIQUE (league_id, manager_id, roster_slot)
) TABLESPACE pg_default;

-- Add foreign key constraints (if table already exists without them)
DO $$ 
BEGIN
    -- Add league_id foreign key
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'draft_roster_assignments_league_id_fkey'
    ) THEN
        ALTER TABLE public.draft_roster_assignments
        ADD CONSTRAINT draft_roster_assignments_league_id_fkey 
        FOREIGN KEY (league_id) REFERENCES league_settings (league_id) ON DELETE CASCADE;
    END IF;

    -- Add manager_id foreign key
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'draft_roster_assignments_manager_id_fkey'
    ) THEN
        ALTER TABLE public.draft_roster_assignments
        ADD CONSTRAINT draft_roster_assignments_manager_id_fkey 
        FOREIGN KEY (manager_id) REFERENCES managers (manager_id) ON DELETE CASCADE;
    END IF;

    -- Add player_id foreign key
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'draft_roster_assignments_player_id_fkey'
    ) THEN
        ALTER TABLE public.draft_roster_assignments
        ADD CONSTRAINT draft_roster_assignments_player_id_fkey 
        FOREIGN KEY (player_id) REFERENCES player_list (player_id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_draft_roster_league_manager 
    ON public.draft_roster_assignments 
    USING btree (league_id, manager_id) 
    TABLESPACE pg_default;

-- Create trigger (drop first if exists to avoid errors)
DROP TRIGGER IF EXISTS trigger_update_draft_roster_timestamp ON draft_roster_assignments;
CREATE TRIGGER trigger_update_draft_roster_timestamp 
    BEFORE UPDATE ON draft_roster_assignments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_draft_roster_updated_at();
