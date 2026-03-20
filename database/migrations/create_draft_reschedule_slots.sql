-- Store admin-assigned draft queue numbers and rescheduled draft times per league.
CREATE TABLE IF NOT EXISTS public.draft_reschedule_slots (
  league_id text PRIMARY KEY,
  queue_number integer NOT NULL,
  rescheduled_draft_time timestamp with time zone NOT NULL,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT draft_reschedule_slots_queue_number_positive CHECK (queue_number > 0),
  CONSTRAINT draft_reschedule_slots_league_id_fkey
    FOREIGN KEY (league_id)
    REFERENCES public.league_settings (league_id)
    ON DELETE CASCADE,
  CONSTRAINT draft_reschedule_slots_queue_number_key UNIQUE (queue_number)
);

-- Keep updated_at current on every update.
DROP TRIGGER IF EXISTS trg_draft_reschedule_slots_updated_at ON public.draft_reschedule_slots;
CREATE TRIGGER trg_draft_reschedule_slots_updated_at
BEFORE UPDATE ON public.draft_reschedule_slots
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_draft_reschedule_slots_time
  ON public.draft_reschedule_slots (rescheduled_draft_time);
