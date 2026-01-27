import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper: Pick Random Player
async function getRandomAvailablePlayer(leagueId) {
    const { data: taken } = await supabase
        .from('draft_picks')
        .select('player_id')
        .eq('league_id', leagueId)
        .not('player_id', 'is', null);

    const takenIds = taken ? taken.map(p => p.player_id) : [];

    const { data: allPlayers } = await supabase
        .select('player_id')
        .from('player_list');

    const validPlayers = allPlayers.filter(p => !takenIds.includes(p.player_id));

    if (validPlayers.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * validPlayers.length);
    return validPlayers[randomIndex].player_id;
}

export async function GET(request, { params }) {
    const { leagueId } = params;

    try {
        // 1. Fetch League Status & Settings
        const { data: statusData } = await supabase
            .from('league_statuses')
            .select('status')
            .eq('league_id', leagueId)
            .single();

        const { data: settings } = await supabase
            .from('league_settings')
            .select('live_draft_time, live_draft_pick_time')
            .eq('league_id', leagueId)
            .single();

        let leagueStatus = statusData?.status;
        const now = new Date();
        const startTime = settings?.live_draft_time ? new Date(settings.live_draft_time) : null;

        // 2. Check Picks counts
        const { count: totalPicks } = await supabase
            .from('draft_picks')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', leagueId);

        const { count: remainingPicks } = await supabase
            .from('draft_picks')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', leagueId)
            .is('player_id', null);

        console.log(`[DraftState] Total: ${totalPicks}, Remaining: ${remainingPicks}, Status: ${leagueStatus}`);

        // 3. Logic Determination

        // CASE A: No picks generated yet
        if (totalPicks === 0) {
            return NextResponse.json({
                status: 'pre-draft',
                message: 'Draft order not generated'
            });
        }

        // CASE B: Picks exist, some remaining
        if (remainingPicks > 0) {

            // Check if we should START the draft
            if (startTime && now >= startTime) {
                // Time arrived! Ensure status is 'drafting now'
                if (leagueStatus !== 'drafting now') {
                    console.log('[DraftState] Time arrived. Switching to "drafting now"...');
                    await supabase.from('league_statuses').update({ status: 'drafting now' }).eq('league_id', leagueId);
                    leagueStatus = 'drafting now';
                }
            } else {
                // Time NOT arrived yet.
                if (leagueStatus === 'pre-draft') {
                    return NextResponse.json({
                        status: 'pre-draft',
                        startTime: settings?.live_draft_time,
                        serverTime: now.toISOString(),
                        remainingPicks
                    });
                }
            }

            // If we are here, we are active

            // Fetch Current Pick Logic
            let { data: currentPicks } = await supabase
                .from('draft_picks')
                .select('*')
                .eq('league_id', leagueId)
                .is('player_id', null)
                .order('pick_number', { ascending: true })
                .limit(1);

            let currentPick = currentPicks?.[0];

            if (!currentPick) {
                console.warn('[DraftState] Remaining > 0 but currentPick not found?');
                return NextResponse.json({ status: 'completed' });
            }

            // Get Pick Duration
            let duration = 60; // Default
            if (settings?.live_draft_pick_time) {
                const timeStr = settings.live_draft_pick_time.toLowerCase();
                if (timeStr.includes('minute')) {
                    // "1 Minute", "2 Minutes", "3 Minutes" -> 1, 2, 3 * 60
                    duration = parseInt(timeStr) * 60;
                } else if (timeStr.includes('second')) {
                    // "30 Seconds" -> 30
                    duration = parseInt(timeStr);
                }
            }

            // Init Deadline if needed
            if (!currentPick.deadline) {
                const nextDeadline = new Date(now.getTime() + duration * 1000);
                const { data: updated, error: updateError } = await supabase
                    .from('draft_picks')
                    .update({ deadline: nextDeadline.toISOString() })
                    .eq('pick_id', currentPick.pick_id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('[Draft] Failed to update deadline:', updateError);
                }

                if (updated) {
                    currentPick = updated;
                } else {
                    // Fallback: Force local update so UI receives the deadline even if DB read-back failed
                    currentPick.deadline = nextDeadline.toISOString();
                }
            }
            // Expired -> AUTO PICK
            else if (new Date(currentPick.deadline) < now) {
                console.log(`[Draft] Pick ${currentPick.pick_number} expired. Auto-picking...`);

                // 1. Check Draft Queue
                const { data: queueItems } = await supabase
                    .from('draft_queues')
                    .select('player_id, queue_id')
                    .eq('league_id', leagueId)
                    .eq('manager_id', currentPick.manager_id)
                    .order('rank_order', { ascending: true });

                let pickedPlayerId = null;
                let usedQueueId = null;

                if (queueItems && queueItems.length > 0) {
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

                // 2. Random Fallback
                if (!pickedPlayerId) pickedPlayerId = await getRandomAvailablePlayer(leagueId);

                if (pickedPlayerId) {
                    await supabase.from('draft_picks')
                        .update({ player_id: pickedPlayerId, is_auto_picked: true, picked_at: now.toISOString() })
                        .eq('pick_id', currentPick.pick_id);

                    if (usedQueueId) await supabase.from('draft_queues').delete().eq('queue_id', usedQueueId);

                    // Fetch next immediately to update return
                    const { data: nextPicks } = await supabase
                        .from('draft_picks')
                        .select('*')
                        .eq('league_id', leagueId)
                        .is('player_id', null)
                        .order('pick_number', { ascending: true })
                        .limit(1);

                    if (nextPicks && nextPicks.length > 0) {
                        currentPick = nextPicks[0];
                        const nextDeadline = new Date(now.getTime() + duration * 1000);
                        const { data: nextUpdated, error: nextUpError } = await supabase
                            .from('draft_picks')
                            .update({ deadline: nextDeadline.toISOString() })
                            .eq('pick_id', currentPick.pick_id)
                            .select()
                            .single();

                        if (nextUpError) console.error('AutoPick Deadline Error:', nextUpError);

                        if (nextUpdated) {
                            currentPick = nextUpdated;
                        } else {
                            currentPick.deadline = nextDeadline.toISOString();
                        }
                    } else {
                        // Finished just now
                        console.log('[DraftState] Last pick made. Finished.');
                        await supabase.from('league_statuses').update({ status: 'post-draft & pre-season' }).eq('league_id', leagueId);
                        return NextResponse.json({ status: 'completed' });
                    }
                }
            }

            // Return Active State
            const { data: picks, error: picksError } = await supabase
                .from('draft_picks')
                .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, player:player_list(name, team, batter_or_pitcher)')
                .eq('league_id', leagueId)
                .filter('player_id', 'not.is', null)
                .order('pick_number', { ascending: true });

            // Optimize: Batch fetch positions
            if (picks && picks.length > 0) {
                const playerIds = picks.map(p => p.player_id).filter(Boolean);

                // Fetch all relevant positions in parallel
                const [{ data: batterPos }, { data: pitcherPos }] = await Promise.all([
                    supabase.from('v_batter_positions').select('player_id, position_list').in('player_id', playerIds),
                    supabase.from('v_pitcher_positions').select('player_id, position_list').in('player_id', playerIds)
                ]);

                const posMap = {};
                if (batterPos) batterPos.forEach(b => posMap[b.player_id] = b.position_list);
                if (pitcherPos) pitcherPos.forEach(p => posMap[p.player_id] = p.position_list);

                for (const pick of picks) {
                    if (pick.player && posMap[pick.player_id]) {
                        pick.player.position_list = posMap[pick.player_id];
                    }
                }
            }

            console.log(`[DraftState] ✅ Completed picks (player_id NOT NULL): ${picks?.length || 0}`);
            if (picksError) {
                console.error('[DraftState] Error fetching picks:', picksError);
            }
            if (picks && picks.length > 0) {
                console.log(`[DraftState] Sample completed pick: ${JSON.stringify(picks[0])}`);
            }

            // Get Next Picks Preview (e.g., next 12)
            const { data: nextPicks, error: nextPicksError } = await supabase
                .from('draft_picks')
                .select('pick_id, pick_number, round_number, manager_id')
                .eq('league_id', leagueId)
                .is('player_id', null)
                .order('pick_number', { ascending: true });

            if (nextPicksError) {
                console.error('[DraftState] Error fetching nextPicks:', nextPicksError);
            } else {
                console.log(`[DraftState] Next Picks found: ${nextPicks?.length}`);
                if (nextPicks?.length > 0) {
                    console.log(`First Next Pick: ${JSON.stringify(nextPicks[0])}`);
                } else {
                    // Debug: Why empty? Check total picks again
                    const { count } = await supabase.from('draft_picks').select('*', { count: 'exact', head: true }).eq('league_id', leagueId).is('player_id', null);
                    console.log(`[DraftState] Double check remaining count: ${count}`);
                }
            }

            return NextResponse.json({
                status: 'active',
                currentPick,
                picks: picks || [],
                nextPicks: nextPicks || [],
                serverTime: now.toISOString()
            });
        }

        // CASE C: Total > 0 but Remaining == 0 -> Finished
        if (remainingPicks === 0 && totalPicks > 0) {
            if (leagueStatus !== 'post-draft & pre-season' && leagueStatus !== 'in-season') {
                console.log('[DraftState] All picks done. Updating to post-draft & pre-season.');
                await supabase.from('league_statuses').update({ status: 'post-draft & pre-season' }).eq('league_id', leagueId);
            }

            const { data: picks } = await supabase
                .from('draft_picks')
                .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, player:player_list(name, team, batter_or_pitcher)')
                .eq('league_id', leagueId)
                .filter('player_id', 'not.is', null)
                .order('pick_number', { ascending: true });

            // Optimize: Batch fetch positions
            if (picks && picks.length > 0) {
                const playerIds = picks.map(p => p.player_id).filter(Boolean);

                // Fetch all relevant positions in parallel
                const [{ data: batterPos }, { data: pitcherPos }] = await Promise.all([
                    supabase.from('v_batter_positions').select('player_id, position_list').in('player_id', playerIds),
                    supabase.from('v_pitcher_positions').select('player_id, position_list').in('player_id', playerIds)
                ]);

                const posMap = {};
                if (batterPos) batterPos.forEach(b => posMap[b.player_id] = b.position_list);
                if (pitcherPos) pitcherPos.forEach(p => posMap[p.player_id] = p.position_list);

                for (const pick of picks) {
                    if (pick.player && posMap[pick.player_id]) {
                        pick.player.position_list = posMap[pick.player_id];
                    }
                }
            }

            console.log(`[DraftState] Draft completed! Total picks: ${picks?.length || 0}`);

            return NextResponse.json({ status: 'completed', picks: picks || [] });
        }

        return NextResponse.json({ status: 'unknown', message: 'Unknown State' });

    } catch (error) {
        console.error('Draft State Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
