import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
    try {
        // Next.js 15: params should be awaited
        const resolvedParams = await params;
        const { playerId: rawPlayerId } = resolvedParams;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'batter' or 'pitcher'

        if (!rawPlayerId || rawPlayerId === 'undefined' || rawPlayerId === 'null') {
            return NextResponse.json({ success: false, error: 'Invalid playerId' });
        }

        // Convert playerId to integer for database query (view uses integer player_id)
        const playerId = parseInt(rawPlayerId, 10);
        if (isNaN(playerId)) {
            return NextResponse.json({ success: false, error: 'Invalid playerId format' });
        }

        const timeWindows = [
            'Today',
            'Yesterday',
            'Last 7 Days',
            'Last 14 Days',
            'Last 30 Days',
            '2026 Season',
            '2025 Season'
        ];

        // 1. Determine player type (batter or pitcher)
        // If type is passed from frontend, use it. Otherwise, query database.
        let isPitcher = type === 'pitcher';
        if (!type) {
            const { data: playerInfo, error: playerError } = await supabase
                .from('player_list')
                .select('batter_or_pitcher')
                .eq('player_id', playerId)
                .single();

            if (!playerError && playerInfo) {
                isPitcher = playerInfo.batter_or_pitcher === 'pitcher';
            }
        }

        let battingData = [];
        let pitchingData = [];

        // 2. Fetch from the specific view based on player type
        if (isPitcher) {
            const { data, error } = await supabase
                .from('v_pitching_summary')
                .select('*')
                .eq('player_id', playerId)
                .in('time_window', timeWindows);

            if (error) {
                console.error('Pitching View Error:', error);
            } else {
                pitchingData = data || [];
            }
        } else {
            const { data, error } = await supabase
                .from('v_batting_summary')
                .select('*')
                .eq('player_id', playerId)
                .in('time_window', timeWindows);

            if (error) {
                console.error('Batting View Error:', error);
            } else {
                battingData = data || [];
            }
        }

        // Organize the data by time window
        const battingByWindow = {};
        const pitchingByWindow = {};

        timeWindows.forEach(tw => {
            battingByWindow[tw] = battingData.find(d => d.time_window === tw) || null;
            pitchingByWindow[tw] = pitchingData.find(d => d.time_window === tw) || null;
        });

        // Debug: log the data counts
        console.log(`Player ${playerId} (isPitcher: ${isPitcher}): batting=${battingData.length}, pitching=${pitchingData.length}`);

        return NextResponse.json({
            success: true,
            batting: battingByWindow,
            pitching: pitchingByWindow,
            isPitcher,
            playerId, // for debugging
            debug: {
                battingDataCount: battingData.length,
                pitchingDataCount: pitchingData.length,
                typeParam: type
            }
        });

    } catch (err) {
        console.error('API Error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
