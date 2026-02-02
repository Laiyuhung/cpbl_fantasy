import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper: Pick Random Player
// Helper: Pick Random Player
async function getRandomAvailablePlayer(leagueId, excludePlayerIds = []) {
    const { data: taken } = await supabase
        .from('draft_picks')
        .select('player_id')
        .eq('league_id', leagueId)
        .not('player_id', 'is', null);

    const takenIds = taken ? taken.map(p => p.player_id) : [];
    const allExcluded = [...takenIds, ...excludePlayerIds];

    const { data: allPlayers } = await supabase
        .from('player_list')
        .select('player_id')
        .eq('available', true);  // Only select available players

    const validPlayers = allPlayers?.filter(p => !allExcluded.includes(p.player_id)) || [];

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
            .select('live_draft_time, live_draft_pick_time, foreigner_active_limit')
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
                    // Fetch "taken" picks (usually empty in pre-draft, but robust to check)
                    const { data: picks, error: picksError } = await supabase
                        .from('draft_picks')
                        .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, player:player_list(name, team, batter_or_pitcher, identity)')
                        .eq('league_id', leagueId)
                        .filter('player_id', 'not.is', null)
                        .order('pick_number', { ascending: true });

                    // Optimize: Batch fetch positions for taken picks
                    if (picks && picks.length > 0) {
                        const playerIds = picks.map(p => p.player_id).filter(Boolean);

                        const [batterPosRes, pitcherPosRes] = await Promise.all([
                            supabase.from('v_batter_positions').select('player_id, position_list').in('player_id', playerIds),
                            supabase.from('v_pitcher_positions').select('player_id, position_list').in('player_id', playerIds)
                        ]);

                        const posMap = {};
                        if (batterPosRes.data) batterPosRes.data.forEach(b => posMap[b.player_id] = b.position_list);
                        if (pitcherPosRes.data) pitcherPosRes.data.forEach(p => posMap[p.player_id] = p.position_list);

                        for (const pick of picks) {
                            if (pick.player && posMap[pick.player_id]) {
                                pick.player.position_list = posMap[pick.player_id];
                            }
                        }
                    }

                    // Fetch "next" picks (all remaining picks)
                    const { data: nextPicks, error: nextPicksError } = await supabase
                        .from('draft_picks')
                        .select('pick_id, pick_number, round_number, manager_id')
                        .eq('league_id', leagueId)
                        .is('player_id', null)
                        .order('pick_number', { ascending: true });

                    return NextResponse.json({
                        status: 'pre-draft',
                        startTime: settings?.live_draft_time,
                        serverTime: now.toISOString(),
                        remainingPicks,
                        picks: picks || [],
                        nextPicks: nextPicks || [],
                        foreignerActiveLimit: settings?.foreigner_active_limit
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
                // Calculate deadline from previous pick's picked_at time
                let baseTime = now;

                // Find the most recent completed pick
                const { data: lastPick } = await supabase
                    .from('draft_picks')
                    .select('picked_at, pick_number, player_id')
                    .eq('league_id', leagueId)
                    .not('player_id', 'is', null)
                    .order('pick_number', { ascending: false })
                    .limit(1)
                    .single();

                if (lastPick?.picked_at) {
                    baseTime = new Date(lastPick.picked_at).getTime();
                    console.log('[Deadline Calc] Previous Pick:', {
                        pickNumber: lastPick.pick_number,
                        pickedAt: lastPick.picked_at,
                        baseTime: new Date(baseTime).toISOString()
                    });
                } else {
                    console.log('[Deadline Calc] No previous pick found, using server time');
                }

                const nextDeadline = new Date(baseTime + duration * 1000);
                const diff = Math.floor((nextDeadline.getTime() - now) / 1000);

                console.log('[Deadline Calc] Calculation:', {
                    previousPickTime: lastPick?.picked_at || 'N/A',
                    nowTime: new Date(now).toISOString(),
                    duration: `${duration}s`,
                    calculatedDeadline: nextDeadline.toISOString(),
                    diff: `${diff}s`
                });
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

                // 0. Check Foreigner Limit Status for this Manager
                const foreignerLimit = settings?.foreigner_active_limit;
                let excludeForeigners = false;
                let foreignIds = new Set();

                if (foreignerLimit !== null && foreignerLimit !== undefined) {
                    // Count current foreigners for this manager
                    const { data: myPicks } = await supabase
                        .from('draft_picks')
                        .select('player_id, player:player_list(identity)')
                        .eq('league_id', leagueId)
                        .eq('manager_id', currentPick.manager_id)
                        .not('player_id', 'is', null);

                    const myForeignerCount = myPicks?.filter(p => {
                        const id = (p.player?.identity || '').toLowerCase();
                        return id === 'foreigner' || id === 'f';
                    }).length || 0;

                    if (myForeignerCount >= foreignerLimit) {
                        excludeForeigners = true;
                        // Fetch all foreign player IDs to exclude
                        // Or just filter checks dynamically.
                        // For random fallback we need IDs if we want to update the helper efficiently,
                        // or better: update helper to filter by property too? 
                        // Actually, easiest is to fetch all foreign IDs once if needed.
                        const { data: fPlayers } = await supabase
                            .from('player_list')
                            .select('player_id')
                            .or('identity.ilike.foreigner,identity.ilike.f');

                        fPlayers?.forEach(fp => foreignIds.add(fp.player_id));
                    }
                }

                // 1. Check Draft Queue
                const { data: queueItems } = await supabase
                    .from('draft_queues')
                    .select('player_id, queue_id, player:player_list(identity)')
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
                        // Skip if taken
                        if (takenSet.has(item.player_id)) continue;

                        // Skip if foreigner limit reached and player is foreigner
                        if (excludeForeigners) {
                            const pIdentity = (item.player?.identity || '').toLowerCase();
                            if (pIdentity === 'foreigner' || pIdentity === 'f') {
                                console.log(`[Draft] Skipping queued foreigner ${item.player_id} due to limit.`);
                                continue;
                            }
                        }

                        pickedPlayerId = item.player_id;
                        usedQueueId = item.queue_id;
                        console.log(`[Draft] Picking from Queue: ${pickedPlayerId}`);
                        break;
                    }
                }

                // 2. Random Fallback
                if (!pickedPlayerId) {
                    const exclusions = excludeForeigners ? Array.from(foreignIds) : [];
                    pickedPlayerId = await getRandomAvailablePlayer(leagueId, exclusions);
                }

                if (pickedPlayerId) {
                    // Use optimistic locking: only update if player_id is still NULL
                    // This prevents race conditions when multiple requests try to auto-pick
                    const { data: updateResult, error: updateError } = await supabase
                        .from('draft_picks')
                        .update({
                            player_id: pickedPlayerId,
                            is_auto_picked: true,
                            picked_at: now.toISOString()
                        })
                        .eq('pick_id', currentPick.pick_id)
                        .is('player_id', null)  // Critical: only update if still NULL
                        .select();

                    // Check if update was successful (row was actually updated)
                    if (updateError || !updateResult || updateResult.length === 0) {
                        console.log(`[Draft] Pick ${currentPick.pick_number} already picked by another request. Skipping.`);
                        // Another request already handled this pick, just continue
                        // Re-fetch current state
                        const { data: refreshPicks } = await supabase
                            .from('draft_picks')
                            .select('*')
                            .eq('league_id', leagueId)
                            .is('player_id', null)
                            .order('pick_number', { ascending: true })
                            .limit(1);

                        if (refreshPicks && refreshPicks.length > 0) {
                            currentPick = refreshPicks[0];
                        }
                    } else {
                        console.log(`[Draft] Successfully auto-picked player ${pickedPlayerId} for pick ${currentPick.pick_number}`);

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
                            // await supabase.from('league_statuses').update({ status: 'post-draft & pre-season' }).eq('league_id', leagueId);
                            return NextResponse.json({ status: 'completed' });
                        }
                    }
                }
            }

            // Return Active State
            const { data: picks, error: picksError } = await supabase
                .from('draft_picks')
                .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, player:player_list(name, team, batter_or_pitcher, identity)')
                .eq('league_id', leagueId)
                .filter('player_id', 'not.is', null)
                .order('pick_number', { ascending: true });

            // Optimize: Batch fetch positions
            if (picks && picks.length > 0) {
                const playerIds = picks.map(p => p.player_id).filter(Boolean);

                // Fetch all relevant positions in parallel
                const [batterPosRes, pitcherPosRes] = await Promise.all([
                    supabase.from('v_batter_positions').select('player_id, position_list').in('player_id', playerIds),
                    supabase.from('v_pitcher_positions').select('player_id, position_list').in('player_id', playerIds)
                ]);

                const batterPos = batterPosRes?.data;
                const pitcherPos = pitcherPosRes?.data;

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
                serverTime: now.toISOString(),
                foreignerActiveLimit: settings?.foreigner_active_limit
            });
        }

        // CASE C: Total > 0 but Remaining == 0 -> Finished
        if (remainingPicks === 0 && totalPicks > 0) {
            if (leagueStatus !== 'post-draft & pre-season' && leagueStatus !== 'in-season') {
                console.log('[DraftState] All picks done. Updating to post-draft & pre-season.');
                // await supabase.from('league_statuses').update({ status: 'post-draft & pre-season' }).eq('league_id', leagueId);
            }

            const { data: picks } = await supabase
                .from('draft_picks')
                .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, player:player_list(name, team, batter_or_pitcher, identity)')
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

            console.log(`[DraftState] Draft completed! Total picks: ${picks?.length || 0}`);
            return NextResponse.json({ status: 'completed', picks: picks || [], foreignerActiveLimit: settings?.foreigner_active_limit });
        }

        return NextResponse.json({ status: 'unknown', message: 'Unknown State' });

    } catch (error) {
        console.error('Draft State Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
