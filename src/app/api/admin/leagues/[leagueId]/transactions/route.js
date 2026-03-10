import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
    try {
        const { leagueId } = params;

        // 1. Admin check
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('manager_id')
            .eq('manager_id', userId)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch league members for manager mapping
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId);

        const memberMap = {};
        if (members) {
            members.forEach(m => {
                memberMap[m.manager_id] = m.nickname;
            });
        }

        // 3. Fetch transactions
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('league_id', leagueId)
            .order('timestamp', { ascending: false });

        if (txError) {
            return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
        }

        // 4. Fetch player data for dropped/added/traded players
        const playerIds = new Set();
        (transactions || []).forEach(tx => {
            if (tx.player_id) playerIds.add(tx.player_id);
            if (tx.details?.addedPlayers) tx.details.addedPlayers.forEach(id => playerIds.add(id));
            if (tx.details?.droppedPlayers) tx.details.droppedPlayers.forEach(id => playerIds.add(id));
            if (tx.details?.offeredPlayers) tx.details.offeredPlayers.forEach(id => playerIds.add(id));
            if (tx.details?.requestedPlayers) tx.details.requestedPlayers.forEach(id => playerIds.add(id));
        });

        let playersMap = {};
        if (playerIds.size > 0) {
            const { data: players } = await supabase
                .from('players')
                .select('player_id, name, team, primary_position, photo_url')
                .in('player_id', Array.from(playerIds));

            (players || []).forEach(p => {
                playersMap[p.player_id] = p;
            });
        }

        return NextResponse.json({
            success: true,
            transactions: transactions || [],
            memberMap,
            playersMap
        });

    } catch (error) {
        console.error('Admin transactions error:', error);
        return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
    }
}
