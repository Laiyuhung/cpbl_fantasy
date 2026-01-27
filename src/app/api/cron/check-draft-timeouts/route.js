import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
    // Verify this is a cron request (optional security check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('[Cron] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Checking for draft timeouts...');

    try {
        // Find all active drafts
        const { data: activeLeagues } = await supabase
            .from('league_statuses')
            .select('league_id, status')
            .eq('status', 'draft in progress');

        if (!activeLeagues || activeLeagues.length === 0) {
            console.log('[Cron] No active drafts found');
            return NextResponse.json({ message: 'No active drafts' });
        }

        console.log(`[Cron] Found ${activeLeagues.length} active draft(s)`);

        const results = [];
        const now = new Date();
        const bufferMs = 10 * 1000; // 10 second buffer

        for (const league of activeLeagues) {
            const leagueId = league.league_id;

            // Get current pick with deadline
            const { data: currentPicks } = await supabase
                .from('draft_picks')
                .select('*')
                .eq('league_id', leagueId)
                .is('player_id', null)
                .order('pick_number', { ascending: true })
                .limit(1);

            const currentPick = currentPicks?.[0];

            if (!currentPick) {
                console.log(`[Cron] League ${leagueId}: No current pick (draft may be complete)`);
                continue;
            }

            if (!currentPick.deadline) {
                console.log(`[Cron] League ${leagueId}: Pick ${currentPick.pick_number} has no deadline set`);
                continue;
            }

            const deadlineTime = new Date(currentPick.deadline).getTime();
            const timeWithBuffer = deadlineTime + bufferMs;

            // Check if expired (deadline + 10s buffer < now)
            if (now.getTime() > timeWithBuffer) {
                console.log(`[Cron] League ${leagueId}: Pick ${currentPick.pick_number} expired (deadline: ${currentPick.deadline}). Executing auto-pick...`);

                try {
                    // Get league settings for next deadline calculation
                    const { data: settings } = await supabase
                        .from('league_settings')
                        .select('live_draft_pick_time')
                        .eq('league_id', leagueId)
                        .single();

                    let duration = 60; // Default
                    if (settings?.live_draft_pick_time) {
                        const timeStr = settings.live_draft_pick_time.toLowerCase();
                        if (timeStr.includes('minute')) {
                            duration = parseInt(timeStr) * 60;
                        } else if (timeStr.includes('second')) {
                            duration = parseInt(timeStr);
                        }
                    }

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
                                console.log(`[Cron] Picking from Queue: ${pickedPlayerId}`);
                                break;
                            }
                        }
                    }

                    // 2. Random Fallback if no queue item available
                    if (!pickedPlayerId) {
                        const { data: availablePlayers } = await supabase
                            .from('player_list')
                            .select('player_id')
                            .eq('available', true);

                        const { data: takenPlayers } = await supabase
                            .from('draft_picks')
                            .select('player_id')
                            .eq('league_id', leagueId)
                            .not('player_id', 'is', null);

                        const takenSet = new Set(takenPlayers?.map(p => p.player_id) || []);
                        const remaining = availablePlayers?.filter(p => !takenSet.has(p.player_id)) || [];

                        if (remaining.length > 0) {
                            const randomIndex = Math.floor(Math.random() * remaining.length);
                            pickedPlayerId = remaining[randomIndex].player_id;
                            console.log(`[Cron] Random pick: ${pickedPlayerId}`);
                        }
                    }

                    if (pickedPlayerId) {
                        // Update current pick
                        await supabase
                            .from('draft_picks')
                            .update({
                                player_id: pickedPlayerId,
                                is_auto_picked: true,
                                picked_at: now.toISOString()
                            })
                            .eq('pick_id', currentPick.pick_id);

                        // Remove from queue if used
                        if (usedQueueId) {
                            await supabase.from('draft_queues').delete().eq('queue_id', usedQueueId);
                        }

                        // Set deadline for next pick
                        const { data: nextPicks } = await supabase
                            .from('draft_picks')
                            .select('pick_id')
                            .eq('league_id', leagueId)
                            .is('player_id', null)
                            .order('pick_number', { ascending: true })
                            .limit(1);

                        if (nextPicks && nextPicks.length > 0) {
                            const nextDeadline = new Date(now.getTime() + duration * 1000);
                            await supabase
                                .from('draft_picks')
                                .update({ deadline: nextDeadline.toISOString() })
                                .eq('pick_id', nextPicks[0].pick_id);
                        } else {
                            // Draft complete
                            await supabase
                                .from('league_statuses')
                                .update({ status: 'post-draft & pre-season' })
                                .eq('league_id', leagueId);
                            console.log(`[Cron] League ${leagueId}: Draft completed`);
                        }

                        results.push({
                            leagueId,
                            pickNumber: currentPick.pick_number,
                            status: 'auto-picked',
                            playerId: pickedPlayerId,
                            fromQueue: !!usedQueueId
                        });
                    } else {
                        console.error(`[Cron] League ${leagueId}: No available players to pick!`);
                        results.push({
                            leagueId,
                            pickNumber: currentPick.pick_number,
                            status: 'error',
                            error: 'No available players'
                        });
                    }
                } catch (err) {
                    console.error(`[Cron] Failed to auto-pick for league ${leagueId}:`, err);
                    results.push({
                        leagueId,
                        pickNumber: currentPick.pick_number,
                        status: 'error',
                        error: err.message
                    });
                }
            } else {
                const timeLeft = Math.floor((timeWithBuffer - now.getTime()) / 1000);
                console.log(`[Cron] League ${leagueId}: Pick ${currentPick.pick_number} not expired yet (${timeLeft}s remaining with buffer)`);
            }
        }

        return NextResponse.json({
            message: 'Cron job completed',
            timestamp: now.toISOString(),
            results
        });

    } catch (error) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
