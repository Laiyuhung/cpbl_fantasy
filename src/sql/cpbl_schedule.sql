-- CPBL Schedule Table Schema
-- Handles game data with support for multiple adjustments (postponements/rescheduling).
-- 'game_no' is the persistent identifier for a match (e.g., Game #1). 
-- If a game is postponed, mark 'is_postponed' = true, and insert a new record for the makeup game with the same 'game_no'.

CREATE TABLE public.cpbl_schedule (
  uuid UUID DEFAULT gen_random_uuid() NOT NULL, -- Unique ID for each record (schedule entry)
  date DATE, -- The scheduled date of the game
  game_no BIGINT, -- Official Game Number (e.g. 1) - Key for tracking reschedules
  time TEXT, -- Game time (e.g. "17:05")
  away TEXT, -- Away Team Name
  home TEXT, -- Home Team Name
  stadium TEXT, -- Stadium Name
  is_postponed BOOLEAN DEFAULT false, -- If true, this specific schedule entry is postponed/invalid
  original_schedule_uuid UUID, -- Optional: Link to the previous postponed record (for history tracking)
  remark TEXT, -- Optional: Reason for postponement or notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT cpbl_schedule_pkey PRIMARY KEY (uuid)
) TABLESPACE pg_default;

-- Index for faster queries on active games
CREATE INDEX idx_cpbl_schedule_date ON public.cpbl_schedule (date);
CREATE INDEX idx_cpbl_schedule_game_no ON public.cpbl_schedule (game_no);

-- Comments
COMMENT ON TABLE public.cpbl_schedule IS 'Stores CPBL game schedule. Use game_no to group original and makeup games.';
COMMENT ON COLUMN public.cpbl_schedule.is_postponed IS 'Set to true if this specific date/entry is postponed. A new row should be created for the makeup date.';
