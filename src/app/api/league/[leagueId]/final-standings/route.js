import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;

    if (!leagueId) {
        return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    try {
        const { data: finalStandings, error } = await supabase
            .from('league_final_standings')
            .select('*')
            .eq('league_id', leagueId)
            .order('rank', { ascending: true });

        if (error) {
            console.error('Error fetching final standings:', error);
            return NextResponse.json({ error: 'Failed to fetch final standings' }, { status: 500 });
        }

        return NextResponse.json({ success: true, finalStandings });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}