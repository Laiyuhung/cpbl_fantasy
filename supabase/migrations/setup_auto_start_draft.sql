-- Auto-start draft 1 hour before scheduled time
CREATE OR REPLACE FUNCTION auto_start_drafts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Change status from 'pre-draft' to 'drafting now' 
    -- when current time is within 1 hour of live_draft_time
    UPDATE league_statuses
    SET status = 'drafting now'
    WHERE league_id IN (
        SELECT ls.league_id
        FROM league_statuses ls
        JOIN league_settings lset ON ls.league_id = lset.league_id
        WHERE ls.status = 'pre-draft'
          AND lset.live_draft_time IS NOT NULL
          AND lset.live_draft_time - INTERVAL '1 hour' <= NOW()
          AND lset.live_draft_time > NOW() - INTERVAL '5 minutes' -- Don't start if already way past
    );
    
    -- Log the action
    RAISE NOTICE 'Auto-start drafts check completed at %', NOW();
END;
$$;

-- Schedule to run every 5 minutes
SELECT cron.schedule(
    'auto-start-drafts',
    '*/5 * * * *',  -- Every 5 minutes
    $$SELECT auto_start_drafts();$$
);

-- To view the scheduled job:
-- SELECT * FROM cron.job WHERE jobname = 'auto-start-drafts';

-- To unschedule (if needed):
-- SELECT cron.unschedule('auto-start-drafts');
