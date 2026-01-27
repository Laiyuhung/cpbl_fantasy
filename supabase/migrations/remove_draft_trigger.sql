-- Remove the trigger and function
DROP TRIGGER IF EXISTS check_timeout_on_pick_change ON draft_picks;
DROP FUNCTION IF EXISTS trigger_check_draft_timeout();

-- That's it! The trigger is now removed.
