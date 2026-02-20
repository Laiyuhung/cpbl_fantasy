import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
    try {
        const { playerId } = params;

        // We want to fetch all stats for the specified time windows
        const timeWindows = [
            'Today',
            'Yesterday',
            'Last 7 Days',
            'Last 14 Days',
            'Last 30 Days',
            '2026 Season',
            '2025 Season'
        ];

        // Fetch batting stats
        const { data: battingData, error: battingError } = await supabase
            .from('v_batting_summary')
            .select('*')
            .eq('player_id', playerId)
            .in('time_window', timeWindows);

        if (battingError) throw battingError;

        // Fetch pitching stats
        const { data: pitchingData, error: pitchingError } = await supabase
            .from('v_pitching_summary')
            .select('*')
            .eq('player_id', playerId)
            .in('time_window', timeWindows);

        if (pitchingError) throw pitchingError;

        // Organize the data by time window for easier frontend consumption
        const battingByWindow = {};
        const pitchingByWindow = {};

        timeWindows.forEach(tw => {
            battingByWindow[tw] = battingData.find(d => d.time_window === tw) || null;
            pitchingByWindow[tw] = pitchingData.find(d => d.time_window === tw) || null;
        });

        return NextResponse.json({
            success: true,
            batting: battingByWindow,
            pitching: pitchingByWindow
        });

    } catch (err) {
        console.error('API Error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
