import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    try {
        const { leagueId } = params;

        if (!leagueId) {
            return NextResponse.json(
                { error: 'League ID is required' },
                { status: 400 }
            );
        }

        // Fetch standings from the v_league_standings view
        const { data: standings, error } = await supabase
            .from('v_league_standings')
            .select('*')
            .eq('league_id', leagueId)
            .order('rank', { ascending: true });

        if (error) {
            console.error('Error fetching standings:', error);
            return NextResponse.json(
                { error: 'Failed to fetch standings', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            standings: standings || [],
        });
    } catch (error) {
        console.error('Unexpected error in standings API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred', details: error.message },
            { status: 500 }
        );
    }
}
