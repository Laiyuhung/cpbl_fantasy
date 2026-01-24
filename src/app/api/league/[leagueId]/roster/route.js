import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');

    if (!leagueId || !managerId) {
        return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    try {
        // Calculate Today's Date in Taiwan Time (UTC+8)
        const now = new Date();
        const taiwanDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        const formattedDate = taiwanDate.toISOString().split('T')[0]; // YYYY-MM-DD

        // Fetch roster from Supabase
        // Join with player_list (Only fetch existing columns)
        const { data: rosterData, error: rosterError } = await supabase
            .from('league_roster_positions')
            .select(`
        *,
        player:player_list (
          player_id,
          name,
          team,
          batter_or_pitcher
        )
      `)
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .eq('game_date', formattedDate);

        if (rosterError) {
            console.error('Supabase error:', rosterError);
            return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
        }

        // Prepare to fetch position eligibility from views
        const playerIds = rosterData.map(r => r.player_id);
        const positionMap = {};

        if (playerIds.length > 0) {
            // Fetch batter positions
            const { data: batterPos } = await supabase
                .from('v_batter_positions')
                .select('player_id, position_list')
                .in('player_id', playerIds);

            // Fetch pitcher positions
            const { data: pitcherPos } = await supabase
                .from('v_pitcher_positions')
                .select('player_id, position_list')
                .in('player_id', playerIds);

            // Merge into map
            batterPos?.forEach(p => positionMap[p.player_id] = p.position_list);
            pitcherPos?.forEach(p => positionMap[p.player_id] = p.position_list);
        }

        // Flatten and Sort
        const positionOrder = {
            'C': 1,
            '1B': 2,
            '2B': 3,
            '3B': 4,
            'SS': 5,
            'CI': 6,
            'MI': 7,
            'LF': 8,
            'CF': 9,
            'RF': 10,
            'OF': 11,
            'Util': 12,
            'SP': 13,
            'RP': 14,
            'P': 15,
            'BN': 16,
            'NA': 17, // Minor
            'IL': 18
        };

        const roster = (rosterData || []).map(item => ({
            ...item,
            name: item.player?.name,
            team: item.player?.team,
            // Use map to get position_list since it's not in player_list table
            position_list: positionMap[item.player_id] || '',
            batter_or_pitcher: item.player?.batter_or_pitcher
        })).sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            return orderA - orderB;
        });

        return NextResponse.json({
            success: true,
            date: formattedDate,
            roster: roster
        });

    } catch (error) {
        console.error('Error fetching roster:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
