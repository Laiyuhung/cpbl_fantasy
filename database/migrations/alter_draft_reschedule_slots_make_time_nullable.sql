-- Allow clearing only draft time while keeping queue number.
ALTER TABLE public.draft_reschedule_slots
  ALTER COLUMN rescheduled_draft_time DROP NOT NULL;
