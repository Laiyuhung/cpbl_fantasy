import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request, { params }) {
    const { leagueId } = params;

    try {
        const body = await request.json();
        const { managerId, playerId } = body;

        // 1. Get Current Active Pick
        const { data: currentPicks, error } = await supabase
            .from('draft_picks')
            .select('*')
            .eq('league_id', leagueId)
            .is('player_id', null)
            .order('pick_number', { ascending: true })
            .limit(1);

        if (error || !currentPicks || currentPicks.length === 0) {
            return NextResponse.json({ success: false, error: 'Draft is not active or completed' }, { status: 400 });
        }

        const currentPick = currentPicks[0];

        // 2. Validate Turn
        if (currentPick.manager_id !== managerId) {
            return NextResponse.json({ success: false, error: 'It is not your turn' }, { status: 403 });
        }

        // 3. Validate Availability
        const { data: taken } = await supabase
            .from('draft_picks')
            .select('pick_id')
            .eq('league_id', leagueId)
            .eq('player_id', playerId)
            .single();

        if (taken) {
            return NextResponse.json({ success: false, error: 'Player already taken' }, { status: 400 });
        }

        // 3.5 Check Foreigner Limit
        const { data: settings } = await supabase
            .from('league_settings')
            .select('foreigner_active_limit')
            .eq('league_id', leagueId)
            .single();

        if (settings?.foreigner_active_limit !== null && settings.foreigner_active_limit !== undefined) {
            // Check if current player is Foreigner
            const { data: playerInfo } = await supabase
                .from('player_list')
                .select('identity')
                .eq('player_id', playerId)
                .single();

            if (playerInfo?.identity === 'Foreigner' || playerInfo?.identity === 'F') {
                // Count how many foreigners this manager already has
                // Optimization: We could use a view or join, but a direct query is clear here.
                // We need to find picking rows for this manager where the player is a foreigner.
                const { data: managerPicks } = await supabase
                    .from('draft_picks')
                    .select('player_id, player:player_list!inner(identity)')
                    .eq('league_id', leagueId)
                    .eq('manager_id', managerId)
                    .not('player_id', 'is', null);

                const currentForeignerCount = managerPicks?.filter(p =>
                    p.player?.identity === 'Foreigner' || p.player?.identity === 'F'
                ).length || 0;

                if (currentForeignerCount >= settings.foreigner_active_limit) {
                    return NextResponse.json({
                        success: false,
                        error: `Foreigner limit reached (${settings.foreigner_active_limit}). You cannot draft more foreign players.`
                    }, { status: 400 });
                }
            }
        }

        const now = new Date();

        // 4. Update Pick
        const { error: pickError } = await supabase
            .from('draft_picks')
            .update({
                player_id: playerId,
                picked_at: now.toISOString(),
                is_auto_picked: false
            })
            .eq('pick_id', currentPick.pick_id);

        if (pickError) throw pickError;

        // 5. Start Next Timer
        // Find next pick
        const { data: nextPicks } = await supabase
            .from('draft_picks')
            .select('pick_id')
            .eq('league_id', leagueId)
            .is('player_id', null)
            .order('pick_number', { ascending: true })
            .limit(1);

        if (nextPicks && nextPicks.length > 0) {
            // Fetch Settings for duration
            const { data: settings } = await supabase
                .from('league_settings')
                .select('live_draft_pick_time')
                .eq('league_id', leagueId)
                .single();

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

            const nextDeadline = new Date(now.getTime() + duration * 1000);
            await supabase
                .from('draft_picks')
                .update({ deadline: nextDeadline.toISOString() })
                .eq('pick_id', nextPicks[0].pick_id);
        } else {
            // Draft Complete
            await supabase.from('league_statuses').update({ status: 'post-draft & pre-season' }).eq('league_id', leagueId);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Draft Pick Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
