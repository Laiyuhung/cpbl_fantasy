-- Create watched_players table for tracking player watchlist
CREATE TABLE IF NOT EXISTS public.watched_players (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    manager_id UUID NOT NULL,
    player_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT watched_players_pkey PRIMARY KEY (id),
    CONSTRAINT fk_watched_league FOREIGN KEY (league_id) REFERENCES league_settings (league_id) ON DELETE CASCADE,
    CONSTRAINT fk_watched_manager FOREIGN KEY (manager_id) REFERENCES managers (manager_id) ON DELETE CASCADE,
    CONSTRAINT fk_watched_player FOREIGN KEY (player_id) REFERENCES player_list (player_id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create unique index to prevent duplicate watches
CREATE UNIQUE INDEX IF NOT EXISTS idx_watched_players_unique 
ON public.watched_players USING btree (league_id, manager_id, player_id) TABLESPACE pg_default;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_watched_players_league_manager 
ON public.watched_players USING btree (league_id, manager_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_watched_players_player 
ON public.watched_players USING btree (player_id) TABLESPACE pg_default;

-- Add comment
COMMENT ON TABLE public.watched_players IS 'Stores player watchlist for each manager in each league';
