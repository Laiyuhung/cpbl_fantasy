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
            const nextDeadline = new Date(now.getTime() + 60 * 1000); // 60s
            await supabase
                .from('draft_picks')
                .update({ deadline: nextDeadline.toISOString() })
                .eq('pick_id', nextPicks[0].pick_id);
        } else {
            // Draft Complete
            await supabase.from('league_statuses').update({ status: 'post-draft' }).eq('league_id', leagueId).eq('status', 'in_draft');
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Draft Pick Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
