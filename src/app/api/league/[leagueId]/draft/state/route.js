import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper: Pick Random Player
async function getRandomAvailablePlayer(leagueId) {
    // 1. Get all taken player IDs
    const { data: taken } = await supabase
        .from('draft_picks')
        .select('player_id')
        .eq('league_id', leagueId)
        .not('player_id', 'is', null);

    const takenIds = taken ? taken.map(p => p.player_id) : [];

    // 2. Fetch a random player not in takenIds
    // Supabase doesn't have easy RANDOM(). We fetch a chunk and pick random JS side.
    // Or call a stored procedure. For MVP, fetch top 100 available and pick one.
    // Optimization: filtering NOT IN a large list is slow.
    // Better: Fetch *all* IDs? No, too big. 
    // MVP: Just fetch top 50 by rank/id where not taken.
    // Actually, let's fetch first 100 players from player_list?
    // We assume player_list is not huge (CPBL ~500 players). FETCH ALL ID is fine.

    const { data: allPlayers } = await supabase
        .select('player_id')
        .from('player_list'); // Assuming small dataset

    const validPlayers = allPlayers.filter(p => !takenIds.includes(p.player_id));

    if (validPlayers.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * validPlayers.length);
    return validPlayers[randomIndex].player_id;
}

export async function GET(request, { params }) {
    const { leagueId } = params;

    try {
        // 1. Get Current Active Pick
        const { data: currentPicks, error } = await supabase
            .from('draft_picks')
            .select('*')
            .eq('league_id', leagueId)
            .is('player_id', null)
            .order('pick_number', { ascending: true })
            .limit(1);

        if (error) throw error;

        // 0. Check League Status first
        const { data: statusData } = await supabase
            .from('league_statuses')
            .select('status')
            .eq('league_id', leagueId)
            .single();

        const leagueStatus = statusData?.status;

        // Fetch Settings (Draft Time & Pick Duration)
        const { data: settings } = await supabase
            .from('league_settings')
            .select('live_draft_time, live_draft_pick_time')
            .eq('league_id', leagueId)
            .single();

        const pickTimeSeconds = (settings?.live_draft_pick_time ? parseInt(settings.live_draft_pick_time) : 60) || 60; // Handle "1 Minute" string if needed? DB usually stores integer or string? 
        // Frontend options: "1 Minute", "30 Seconds". DB stores string? 
        // route.js line 173: settings.general['Live Draft Pick Time'].
        // DB likely string "1 Minute". Parsing needed.
        let duration = 60;
        if (settings?.live_draft_pick_time) {
            if (settings.live_draft_pick_time.includes('Minute')) {
                duration = parseInt(settings.live_draft_pick_time) * 60;
            } else if (settings.live_draft_pick_time.includes('Second')) {
                duration = parseInt(settings.live_draft_pick_time);
            }
        }

        // AUTO START CHECK
        if (currentPicks && currentPicks.length > 0 && leagueStatus === 'pre-draft') {
            const startTime = settings?.live_draft_time ? new Date(settings.live_draft_time) : null;
            // Allow start if time reached OR no time set (manual only? No user said "When time arrives [Auto]").
            if (startTime && now >= startTime) {
                await supabase.from('league_statuses').update({ status: 'in_draft' }).eq('league_id', leagueId);
                // Proceed as in_draft
            } else {
                return NextResponse.json({
                    status: 'pre-draft',
                    startTime: settings?.live_draft_time,
                    message: 'Waiting for draft time or order generation'
                });
            }
        }


        // Draft Completed?
        if (!currentPicks || currentPicks.length === 0) {
            // Debug: Check if TOTAL picks > 0
            const { count } = await supabase.from('draft_picks').select('*', { count: 'exact', head: true }).eq('league_id', leagueId);

            if (count === 0) {
                return NextResponse.json({
                    status: 'pre-draft', // No picks generated yet
                    startTime: settings?.live_draft_time,
                    message: 'Draft order not generated yet'
                });
            }

            if (leagueStatus === 'pre-draft') {
                return NextResponse.json({
                    status: 'pre-draft',
                    startTime: settings?.live_draft_time,
                    message: 'Waiting for start'
                });
            }
            if (leagueStatus === 'in_draft' || !leagueStatus) { // Or active
                // Update status to 'post-draft'
                await supabase.from('league_statuses').update({ status: 'post-draft' }).eq('league_id', leagueId);
            }
            return NextResponse.json({ status: 'completed' });
        }

        let currentPick = currentPicks[0];
        // const now = new Date(); // Already defined

        // 2. Deadline Logic
        // If deadline is NULL, set it (Start the Clock!)
        if (!currentPick.deadline) {
            const nextDeadline = new Date(now.getTime() + duration * 1000);
            const { data: updated, error: updateError } = await supabase
                .from('draft_picks')
                .update({ deadline: nextDeadline.toISOString() })
                .eq('pick_id', currentPick.pick_id)
                .select()
                .single();

            if (!updateError) currentPick = updated;
        }
        // If deadline passed -> AUTO PICK
        else if (new Date(currentPick.deadline) < now) {
            console.log(`[Draft] Pick ${currentPick.pick_number} expired. Auto-picking...`);

            // 1. Check Draft Queue for this Manager
            const { data: queueItems } = await supabase
                .from('draft_queues')
                .select('player_id, queue_id')
                .eq('league_id', leagueId)
                .eq('manager_id', currentPick.manager_id)
                .order('rank_order', { ascending: true });

            let pickedPlayerId = null;
            let usedQueueId = null;

            if (queueItems && queueItems.length > 0) {
                // Check if available
                const { data: taken } = await supabase
                    .from('draft_picks')
                    .select('player_id')
                    .eq('league_id', leagueId)
                    .not('player_id', 'is', null);

                const takenSet = new Set(taken?.map(p => p.player_id) || []);

                for (const item of queueItems) {
                    if (!takenSet.has(item.player_id)) {
                        pickedPlayerId = item.player_id;
                        usedQueueId = item.queue_id;
                        console.log(`[Draft] Picking from Queue: ${pickedPlayerId}`);
                        break;
                    }
                }
            }

            // 2. Fallback to Random
            if (!pickedPlayerId) {
                pickedPlayerId = await getRandomAvailablePlayer(leagueId);
            }

            if (pickedPlayerId) {
                // Determine 'is_auto_picked': true unless from queue? Queue is intentional but automated. Let's mark as true.
                await supabase
                    .from('draft_picks')
                    .update({
                        player_id: pickedPlayerId,
                        is_auto_picked: true,
                        picked_at: now.toISOString()
                    })
                    .eq('pick_id', currentPick.pick_id);

                // Remove from Queue if used
                if (usedQueueId) {
                    await supabase.from('draft_queues').delete().eq('queue_id', usedQueueId);
                }

                // Get NEXT pick
                const { data: nextPicks } = await supabase
                    .from('draft_picks')
                    .select('*')
                    .eq('league_id', leagueId)
                    .is('player_id', null)
                    .order('pick_number', { ascending: true })
                    .limit(1);

                if (nextPicks && nextPicks.length > 0) {
                    currentPick = nextPicks[0];
                    // Initialize next deadline immediately 
                    const nextDeadline = new Date(now.getTime() + duration * 1000);
                    await supabase
                        .from('draft_picks')
                        .update({ deadline: nextDeadline.toISOString() })
                        .eq('pick_id', currentPick.pick_id);
                    currentPick.deadline = nextDeadline.toISOString();
                } else {
                    // Update Status to Post-Draft immediately
                    await supabase.from('league_statuses').update({ status: 'post-draft' }).eq('league_id', leagueId);
                    return NextResponse.json({ status: 'completed' });
                }
            } else {
                console.error('No players left to auto-pick!');
            }
        }

        // 3. Get All Picks (for Board, Taken, My Team)
        const { data: picks } = await supabase
            .from('draft_picks')
            .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, player:player_list(name, team, position, photo_url)')
            .eq('league_id', leagueId)
            .not('player_id', 'is', null)
            .order('pick_number', { ascending: true }); // Order by pick number

        return NextResponse.json({
            status: 'active',
            currentPick: currentPick,
            picks: picks || [],
            serverTime: now.toISOString()
        });

    } catch (error) {
        console.error('Draft State Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
