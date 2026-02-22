-- Create league_chat table for league chat messages
CREATE TABLE IF NOT EXISTS public.league_chat (
    id SERIAL PRIMARY KEY,
    league_id UUID NOT NULL,
    manager_id UUID NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat', -- 'chat', 'system', 'draft_pick'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_chat_league FOREIGN KEY (league_id) REFERENCES league_settings (league_id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_manager FOREIGN KEY (manager_id) REFERENCES managers (manager_id) ON DELETE CASCADE
);

-- Index for efficient querying by league
CREATE INDEX IF NOT EXISTS idx_league_chat_league_id 
ON public.league_chat USING btree (league_id) TABLESPACE pg_default;

-- Index for ordering by time
CREATE INDEX IF NOT EXISTS idx_league_chat_created_at 
ON public.league_chat USING btree (league_id, created_at DESC) TABLESPACE pg_default;

-- Comment
COMMENT ON TABLE public.league_chat IS 'Stores chat messages for each league';
COMMENT ON COLUMN public.league_chat.message_type IS 'Type of message: chat (user message), system (auto-generated), draft_pick (draft notifications)';
