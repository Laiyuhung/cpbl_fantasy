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

        // 2. Fetch league members
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId);

        if (membersError) {
            return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
        }

        // 3. Fetch all rosters in the league
        const managerIds = members.map(m => m.manager_id);

        let rostersData = [];
        let positionsData = [];

        if (managerIds.length > 0) {
            const [rostersRes, positionsRes] = await Promise.all([
                supabase.from('rosters').select('*').in('manager_id', managerIds).eq('league_id', leagueId),
                supabase.from('roster_positions').select('*').in('manager_id', managerIds).eq('league_id', leagueId)
            ]);

            rostersData = rostersRes.data || [];
            positionsData = positionsRes.data || [];
        }

        // 4. Fetch player data
        const playerIds = [
            ...new Set([
                ...rostersData.map(r => r.player_id),
                ...positionsData.map(p => p.player_id)
            ])
        ];

        let playersData = [];
        if (playerIds.length > 0) {
            const { data } = await supabase
                .from('players')
                .select('player_id, name, team, primary_position, secondary_positions, photo_url')
                .in('player_id', playerIds);
            playersData = data || [];
        }

        return NextResponse.json({
            success: true,
            members: members || [],
            rosters: rostersData,
            positions: positionsData,
            players: playersData
        });

    } catch (error) {
        console.error('Admin rosters error:', error);
        return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
    }
}
