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

        // Draft Completed?
        if (!currentPicks || currentPicks.length === 0) {
            if (leagueStatus === 'pre-draft') {
                return NextResponse.json({ status: 'pre-draft' });
            }
            if (leagueStatus === 'in_draft') {
                // Update status to 'post-draft'
                await supabase.from('league_statuses').update({ status: 'post-draft' }).eq('league_id', leagueId);
            }
            return NextResponse.json({ status: 'completed' });
        }

        let currentPick = currentPicks[0];
        const now = new Date();

        // 2. Deadline Logic
        // If deadline is NULL, set it (Start the Clock!)
        if (!currentPick.deadline) {
            const nextDeadline = new Date(now.getTime() + 60 * 1000); // 60 seconds
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

            const randomPlayerId = await getRandomAvailablePlayer(leagueId);

            if (randomPlayerId) {
                await supabase
                    .from('draft_picks')
                    .update({
                        player_id: randomPlayerId,
                        is_auto_picked: true,
                        picked_at: now.toISOString()
                    })
                    .eq('pick_id', currentPick.pick_id);

                // RECURSIVE / RE-FETCH to get the NEXT pick immediately
                // Instead of recursing, we just tell frontend "Refresh again" or return "Processing".
                // But better to return the *Next* pick so UI updates instantly.

                // Let's just fetch the next one.
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
                    const nextDeadline = new Date(now.getTime() + 60 * 1000);
                    await supabase
                        .from('draft_picks')
                        .update({ deadline: nextDeadline.toISOString() })
                        .eq('pick_id', currentPick.pick_id);
                    currentPick.deadline = nextDeadline.toISOString();
                } else {
                    return NextResponse.json({ status: 'completed' });
                }
            } else {
                console.error('No players left to auto-pick!');
                // Should probably finish draft
            }
        }

        // 3. Get Recent Picks (History)
        const { data: recent } = await supabase
            .from('draft_picks')
            .select('pick_number, round_number, player_id, manager_id, player:player_list(name, team, position)')
            .eq('league_id', leagueId)
            .not('player_id', 'is', null)
            .order('pick_number', { ascending: false })
            .limit(5);

        // 4. Get ALL Taken Player IDs for filtering
        const { data: allTaken } = await supabase
            .from('draft_picks')
            .select('player_id')
            .eq('league_id', leagueId)
            .not('player_id', 'is', null);

        const takenIds = allTaken ? allTaken.map(p => p.player_id) : [];

        return NextResponse.json({
            status: 'active',
            currentPick: currentPick,
            recentPicks: recent || [],
            takenPlayerIds: takenIds,
            serverTime: now.toISOString()
        });

    } catch (error) {
        console.error('Draft State Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
