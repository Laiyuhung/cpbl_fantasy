-- Enable pg_cron extension (run this first if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to check and execute auto-picks
CREATE OR REPLACE FUNCTION check_draft_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_league RECORD;
    current_pick_record RECORD;
    picked_player_id UUID;
    queue_item RECORD;
    available_player RECORD;
    next_pick_record RECORD;
    pick_duration INTEGER;
    next_deadline TIMESTAMP WITH TIME ZONE;
    now_time TIMESTAMP WITH TIME ZONE;
    buffer_seconds INTEGER := 10;
BEGIN
    now_time := NOW();
    
    -- Loop through all active drafts
    FOR active_league IN 
        SELECT league_id 
        FROM league_statuses 
        WHERE status = 'draft in progress'
    LOOP
        -- Get current pick
        SELECT * INTO current_pick_record
        FROM draft_picks
        WHERE league_id = active_league.league_id
          AND player_id IS NULL
        ORDER BY pick_number ASC
        LIMIT 1;
        
        -- Skip if no current pick
        IF current_pick_record IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Skip if no deadline set
        IF current_pick_record.deadline IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Check if expired (with 10 second buffer)
        IF now_time > (current_pick_record.deadline + (buffer_seconds || ' seconds')::INTERVAL) THEN
            RAISE NOTICE 'League %: Pick % expired, executing auto-pick', active_league.league_id, current_pick_record.pick_number;
            
            picked_player_id := NULL;
            
            -- 1. Try to pick from queue
            SELECT player_id, queue_id INTO queue_item
            FROM draft_queues
            WHERE league_id = active_league.league_id
              AND manager_id = current_pick_record.manager_id
              AND player_id NOT IN (
                  SELECT player_id 
                  FROM draft_picks 
                  WHERE league_id = active_league.league_id 
                    AND player_id IS NOT NULL
              )
            ORDER BY rank_order ASC
            LIMIT 1;
            
            IF queue_item.player_id IS NOT NULL THEN
                picked_player_id := queue_item.player_id;
                RAISE NOTICE 'Picked from queue: %', picked_player_id;
                
                -- Remove from queue
                DELETE FROM draft_queues WHERE queue_id = queue_item.queue_id;
            ELSE
                -- 2. Random pick from available players
                SELECT player_id INTO available_player
                FROM player_list
                WHERE available = true
                  AND player_id NOT IN (
                      SELECT player_id 
                      FROM draft_picks 
                      WHERE league_id = active_league.league_id 
                        AND player_id IS NOT NULL
                  )
                ORDER BY RANDOM()
                LIMIT 1;
                
                IF available_player.player_id IS NOT NULL THEN
                    picked_player_id := available_player.player_id;
                    RAISE NOTICE 'Random pick: %', picked_player_id;
                END IF;
            END IF;
            
            -- Update current pick if we found a player
            IF picked_player_id IS NOT NULL THEN
                UPDATE draft_picks
                SET player_id = picked_player_id,
                    is_auto_picked = true,
                    picked_at = now_time
                WHERE pick_id = current_pick_record.pick_id;
                
                -- Get pick duration from league settings
                SELECT 
                    CASE 
                        WHEN live_draft_pick_time ILIKE '%minute%' THEN 
                            CAST(SUBSTRING(live_draft_pick_time FROM '[0-9]+') AS INTEGER) * 60
                        WHEN live_draft_pick_time ILIKE '%second%' THEN 
                            CAST(SUBSTRING(live_draft_pick_time FROM '[0-9]+') AS INTEGER)
                        ELSE 60
                    END INTO pick_duration
                FROM league_settings
                WHERE league_id = active_league.league_id;
                
                -- Set deadline for next pick
                SELECT pick_id INTO next_pick_record
                FROM draft_picks
                WHERE league_id = active_league.league_id
                  AND player_id IS NULL
                ORDER BY pick_number ASC
                LIMIT 1;
                
                IF next_pick_record.pick_id IS NOT NULL THEN
                    next_deadline := now_time + (pick_duration || ' seconds')::INTERVAL;
                    
                    UPDATE draft_picks
                    SET deadline = next_deadline
                    WHERE pick_id = next_pick_record.pick_id;
                ELSE
                    -- Draft completed
                    UPDATE league_statuses
                    SET status = 'post-draft & pre-season'
                    WHERE league_id = active_league.league_id;
                    
                    RAISE NOTICE 'League % draft completed', active_league.league_id;
                END IF;
            ELSE
                RAISE WARNING 'League %: No available players to pick!', active_league.league_id;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- Schedule the function to run every minute
SELECT cron.schedule(
    'check-draft-timeouts',           -- Job name
    '* * * * *',                       -- Every minute
    $$SELECT check_draft_timeouts();$$ -- SQL to execute
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule (if needed):
-- SELECT cron.unschedule('check-draft-timeouts');
